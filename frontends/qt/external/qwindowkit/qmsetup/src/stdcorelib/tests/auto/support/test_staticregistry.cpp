// SPDX-License-Identifier: MIT

#include <memory>
#include <string>
#include <vector>

#include <stdcorelib/support/staticregistry.h>

#include <boost/test/unit_test.hpp>

using namespace stdc;

namespace {

    class Codec {
    public:
        virtual ~Codec() = default;
        virtual std::string id() const = 0;
    };

    class FlacCodec : public Codec {
    public:
        std::string id() const override {
            return "flac";
        }
    };

    class OpusCodec : public Codec {
    public:
        std::string id() const override {
            return "opus";
        }
    };

    // No default constructor, which is what Add<V> cannot reach.
    class PcmCodec : public Codec {
    public:
        PcmCodec(int rate, int channels) : _rate(rate), _channels(channels) {
        }
        std::string id() const override {
            return "pcm-" + std::to_string(_rate) + "-" + std::to_string(_channels);
        }

    private:
        int _rate;
        int _channels;
    };

}

STDC_STATIC_REGISTRY(Codec)

namespace {

    using CodecRegistry = StaticRegistry<Codec>;

    // The point of the whole design: these run before main, with no initialization call
    // anywhere, and in the order they are written.
    CodecRegistry::Add<FlacCodec> flac_entry("flac", "Free Lossless Audio Codec");
    CodecRegistry::Add<OpusCodec> opus_entry("opus", "Opus Interactive Audio Codec");

    // Constructor arguments, baked in at the call site. A capture-less lambda is a function
    // pointer, so this costs no more than the Add above.
    CodecRegistry::AddFactory pcm_entry("pcm", "Linear PCM", []() -> std::unique_ptr<Codec> {
        return std::make_unique<PcmCodec>(44100, 2);
    });

}

BOOST_AUTO_TEST_SUITE(test_staticregistry)

BOOST_AUTO_TEST_CASE(test_filled_before_main) {
    std::vector<std::string> names;
    for (const auto &entry : CodecRegistry::entries()) {
        names.push_back(std::string(entry.name()));
    }

    BOOST_REQUIRE_EQUAL(names.size(), 3u);
    BOOST_CHECK_EQUAL(names[0], "flac"); // registration order, not sorted
    BOOST_CHECK_EQUAL(names[1], "opus");
    BOOST_CHECK_EQUAL(names[2], "pcm");
}

BOOST_AUTO_TEST_CASE(test_entries) {
    auto it = CodecRegistry::begin();
    BOOST_CHECK_EQUAL(std::string(it->name()), "flac");
    BOOST_CHECK_EQUAL(std::string(it->desc()), "Free Lossless Audio Codec");

    // each instantiate() is a fresh object, so the registry holds descriptions not instances
    auto first = it->instantiate();
    auto second = it->instantiate();
    BOOST_REQUIRE(first && second);
    BOOST_CHECK(first.get() != second.get());
    BOOST_CHECK_EQUAL(first->id(), "flac");

    BOOST_CHECK(++it != CodecRegistry::end());
    BOOST_CHECK(++it != CodecRegistry::end());
    BOOST_CHECK(++it == CodecRegistry::end());
}

// Add<V> can only default construct. AddFactory is how an implementation that takes arguments
// gets in.
BOOST_AUTO_TEST_CASE(test_factory_entry) {
    const CodecRegistry::Entry *pcm = nullptr;
    for (const auto &entry : CodecRegistry::entries()) {
        if (entry.name() == "pcm") {
            pcm = &entry;
        }
    }
    BOOST_REQUIRE(pcm);
    BOOST_CHECK_EQUAL(std::string(pcm->desc()), "Linear PCM");

    auto codec = pcm->instantiate();
    BOOST_REQUIRE(codec);
    BOOST_CHECK_EQUAL(codec->id(), "pcm-44100-2"); // the arguments survived
}

BOOST_AUTO_TEST_SUITE_END()
