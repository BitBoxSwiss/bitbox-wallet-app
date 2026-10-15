// SPDX-License-Identifier: MIT

#include <chrono>
#include <future>
#include <memory>
#include <string>
#include <thread>
#include <type_traits>
#include <vector>

#include <stdcorelib/support/dynamicregistry.h>
#include <stdcorelib/support/sharedlibrary.h>

#include "../plugins/test_dynamicregistry_plugin.h"

#include <boost/test/unit_test.hpp>

using namespace stdc;

namespace {

    struct Widget {
        virtual ~Widget() = default;
        int tag = 0;
    };

    struct Descriptor {
        int tag;
    };

}

namespace stdc {

    template <>
    struct dynamic_registry_traits<Descriptor> {
        using result_type = Descriptor;

        static result_type empty() {
            return {-1};
        }
    };

}

namespace {

    using WidgetRegistry = DynamicRegistry<Widget>;

    WidgetRegistry::EntryPointer make(const std::string &name, int tag) {
        WidgetRegistry::instance().add(name, name + " widget", [tag] {
            auto w = std::unique_ptr<Widget>(new Widget());
            w->tag = tag;
            return w;
        });
        return WidgetRegistry::instance().find(name);
    }

    // The registry is process wide, so a case that leaves entries behind would be seen by the
    // next one.
    struct RegistryGuard {
        ~RegistryGuard() {
            WidgetRegistry::instance().clear();
        }
    };

    class CountingListener : public WidgetRegistry::Listener {
    public:
        void entry_added(const WidgetRegistry::EntryPointer &entry) override {
            added.push_back(entry->name());
        }
        void entry_removed(const WidgetRegistry::EntryPointer &entry) override {
            removed.push_back(entry->name());
        }
        std::vector<std::string> added, removed;
    };

    // Overrides neither, which is what a listener installed for a purpose it has not written yet
    // looks like. The inherited bodies do nothing, and the registry must call them all the same.
    class SilentListener : public WidgetRegistry::Listener {};

}

BOOST_AUTO_TEST_SUITE(test_dynamicregistry)

BOOST_AUTO_TEST_CASE(test_add_find_remove) {
    RegistryGuard guard;
    auto &reg = WidgetRegistry::instance();

    BOOST_CHECK(make("alpha", 1) != nullptr);
    BOOST_CHECK_EQUAL(reg.size(), 1u);

    // a name is taken only once
    BOOST_CHECK(!reg.add("alpha", "again", [] { return std::unique_ptr<Widget>(new Widget()); }));
    BOOST_CHECK_EQUAL(reg.size(), 1u);

    auto entry = reg.find("alpha");
    BOOST_REQUIRE(entry);
    BOOST_CHECK_EQUAL(entry->name(), "alpha");
    BOOST_CHECK_EQUAL(entry->desc(), "alpha widget");
    BOOST_CHECK_EQUAL(entry->instantiate()->tag, 1);

    // instantiate() by name is the same thing without the lookup in between
    auto direct = reg.instantiate("alpha");
    BOOST_REQUIRE(direct);
    BOOST_CHECK_EQUAL(direct->tag, 1);

    BOOST_CHECK(!reg.find("nothing"));
    BOOST_CHECK(!reg.instantiate("nothing"));

    BOOST_CHECK(reg.remove("alpha"));
    BOOST_CHECK(!reg.remove("alpha"));
    BOOST_CHECK(!reg.find("alpha"));

    // the entry we are still holding outlives its removal, which is why they are shared
    BOOST_CHECK_EQUAL(entry->instantiate()->tag, 1);
}

BOOST_AUTO_TEST_CASE(test_value_result) {
    using DescriptorRegistry = DynamicRegistry<Descriptor>;
    auto &reg = DescriptorRegistry::instance();
    reg.clear();

    static_assert(std::is_same_v<DescriptorRegistry::result_type, Descriptor>);
    BOOST_CHECK_EQUAL(reg.instantiate("missing").tag, -1);

    BOOST_REQUIRE(reg.add("answer", "", []() -> Descriptor { return {42}; }));
    BOOST_CHECK_EQUAL(reg.find("answer")->instantiate().tag, 42);
    BOOST_CHECK_EQUAL(reg.instantiate("answer").tag, 42);

    reg.clear();
}

BOOST_AUTO_TEST_CASE(test_entries_are_sorted) {
    RegistryGuard guard;
    make("gamma", 3);
    make("alpha", 1);
    make("beta", 2);

    auto entries = WidgetRegistry::instance().entries();
    BOOST_REQUIRE_EQUAL(entries.size(), 3u);
    BOOST_CHECK_EQUAL(entries[0]->name(), "alpha");
    BOOST_CHECK_EQUAL(entries[1]->name(), "beta");
    BOOST_CHECK_EQUAL(entries[2]->name(), "gamma");
}

BOOST_AUTO_TEST_CASE(test_listeners) {
    RegistryGuard guard;
    auto &reg = WidgetRegistry::instance();

    CountingListener listener;
    reg.add_listener(&listener);
    reg.add_listener(&listener); // twice is once

    make("one", 1);
    reg.remove("one");

    BOOST_REQUIRE_EQUAL(listener.added.size(), 1u);
    BOOST_CHECK_EQUAL(listener.added[0], "one");
    BOOST_REQUIRE_EQUAL(listener.removed.size(), 1u);
    BOOST_CHECK_EQUAL(listener.removed[0], "one");

    reg.remove_listener(&listener);
    make("two", 2);
    BOOST_CHECK_EQUAL(listener.added.size(), 1u); // no longer told
}

BOOST_AUTO_TEST_CASE(test_removing_listener_waits_for_callbacks) {
    RegistryGuard guard;
    auto &reg = WidgetRegistry::instance();

    class BlockingListener : public WidgetRegistry::Listener {
    public:
        void entry_added(const WidgetRegistry::EntryPointer &) override {
            entered.set_value();
            release.get_future().wait();
        }

        std::promise<void> entered;
        std::promise<void> release;
    } listener;

    auto entered = listener.entered.get_future();
    reg.add_listener(&listener);
    std::thread notifier([&] { make("blocked", 1); });
    entered.wait();

    auto removed = std::async(std::launch::async, [&] { reg.remove_listener(&listener); });
    BOOST_CHECK(removed.wait_for(std::chrono::milliseconds(20)) == std::future_status::timeout);

    listener.release.set_value();
    notifier.join();
    removed.get();
}

// One that overrides nothing is told the same things and does nothing with them. Both halves are
// declared virtual with a body rather than pure, so this has to compile and has to be harmless.
BOOST_AUTO_TEST_CASE(test_a_listener_may_override_neither_half) {
    RegistryGuard guard;
    auto &reg = WidgetRegistry::instance();

    SilentListener silent;
    reg.add_listener(&silent);

    make("three", 3);
    BOOST_CHECK_EQUAL(reg.size(), 1u);
    BOOST_CHECK(reg.remove("three"));
    BOOST_CHECK_EQUAL(reg.size(), 0u);

    reg.remove_listener(&silent);
}

// The registry takes a lock, so registering from several threads at once has to come out with
// every entry present and none of them duplicated.
BOOST_AUTO_TEST_CASE(test_is_thread_safe) {
    RegistryGuard guard;
    auto &reg = WidgetRegistry::instance();

    constexpr int Threads = 8;
    constexpr int PerThread = 50;

    std::vector<std::thread> workers;
    for (int t = 0; t < Threads; ++t) {
        workers.emplace_back([t, PerThread, &reg] {
            for (int i = 0; i < PerThread; ++i) {
                auto name = std::to_string(t) + "." + std::to_string(i);
                reg.add(name, {}, [] { return std::unique_ptr<Widget>(new Widget()); });
                std::ignore = reg.find(name);
                std::ignore = reg.entries();
            }
        });
    }
    for (auto &worker : workers) {
        worker.join();
    }

    BOOST_CHECK_EQUAL(reg.size(), size_t(Threads * PerThread));
}

#ifdef TEST_DYNAMICREGISTRY_PLUGIN_PATH

// A registry declared in a header is only one registry if the singleton is. The instance used to
// be a function-local static, which gives one copy per module, so a plugin registered somewhere
// the host never looked and said nothing about it.
BOOST_AUTO_TEST_CASE(test_a_plugin_registers_where_the_host_looks) {
    SharedLibrary plugin;
    BOOST_REQUIRE_MESSAGE(plugin.open(TEST_DYNAMICREGISTRY_PLUGIN_PATH), plugin.errorMessage());

    auto add = reinterpret_cast<bool (*)(const char *, int)>(plugin.resolve("registry_plugin_add"));
    auto count = reinterpret_cast<size_t (*)()>(plugin.resolve("registry_plugin_size"));
    auto address = reinterpret_cast<const void *(*) ()>(plugin.resolve("registry_plugin_address"));
    BOOST_REQUIRE(add && count && address);

    auto &here = DynamicRegistry<PluginWidget>::instance();
    here.clear();

    BOOST_REQUIRE(add("from-the-plugin", 7));

#  ifdef STDC_STATIC
    // Each module linked its own table, so each has a registry of its own. Nothing to check
    // beyond the plugin not having disturbed this one.
    BOOST_TEST_MESSAGE("stdcorelib is linked statically here, so the modules have a registry each");
    BOOST_CHECK(address() != static_cast<const void *>(&here));
#  else
    BOOST_CHECK(address() == static_cast<const void *>(&here));
    BOOST_CHECK_EQUAL(count(), here.size());

    // and the entry is usable from this side, factory and all
    auto entry = here.find("from-the-plugin");
    BOOST_REQUIRE(entry);
    BOOST_CHECK_EQUAL(entry->desc(), "registered by the plugin");

    auto widget = entry->instantiate();
    BOOST_REQUIRE(widget);
    BOOST_CHECK_EQUAL(widget->tag(), 7);

    // the host registering is equally visible from the plugin
    here.add("from-the-host", {}, [] { return std::unique_ptr<PluginWidget>(); });
    BOOST_CHECK_EQUAL(count(), size_t(2));
#  endif

    here.clear();
}

#endif // TEST_DYNAMICREGISTRY_PLUGIN_PATH

BOOST_AUTO_TEST_SUITE_END()
