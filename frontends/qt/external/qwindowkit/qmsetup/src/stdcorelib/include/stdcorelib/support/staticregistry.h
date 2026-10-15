// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_STATICREGISTRY_H
#define STDCORELIB_STATICREGISTRY_H

#include <memory>
#include <string_view>

#include <stdcorelib/stdc_global.h>

namespace stdc {

    /// \addtogroup types
    /// @{

    /// Controls what a \c StaticRegistry constructs for one registered implementation.
    ///
    /// The default returns an owning pointer so derived implementations retain their dynamic
    /// type. Specialize this trait when \a T is a small descriptor that should be returned by
    /// value instead.
    template <class T>
    struct static_registry_traits {
        using result_type = std::unique_ptr<T>;

        template <class V>
        static result_type construct() {
            return std::make_unique<V>();
        }
    };

    /// A registry that fills itself before \c main, so an implementation is available merely by
    /// having been linked in.
    ///
    /// Every registration object links itself into a list and takes itself back out when it is
    /// destroyed. Nothing calls an initialization function and nothing keeps a list of what to
    /// initialize, which is what makes it work across a shared library boundary: a plugin's own
    /// static object joins the host's list as the plugin is loaded, and leaves it as the plugin
    /// unloads.
    ///
    /// \code
    ///   // in the host
    ///   class Codec { public: virtual ~Codec() = default; };
    ///   using CodecRegistry = stdc::StaticRegistry<Codec>;
    ///   STDC_STATIC_REGISTRY(Codec)   // once, in one .cpp
    ///
    ///   // in the host or in any plugin
    ///   static CodecRegistry::Add<FlacCodec> x("flac", "Free Lossless Audio Codec");
    ///
    ///   for (const auto &entry : CodecRegistry::entries()) {
    ///       if (entry.name() == wanted) {
    ///           return entry.instantiate();
    ///       }
    ///   }
    /// \endcode
    ///
    /// The list is the only structure that can be built this way. A map or a vector has a
    /// constructor of its own, so touching one from a static constructor races with its own
    /// initialization. The storage accessor initializes its two pointers before returning them
    /// to a registration.
    ///
    /// \note For a plugin to reach the host's list, declare the registry with
    ///       \c STDC_DECLARE_EXPORTED_STATIC_REGISTRY and define it with
    ///       \c STDC_STATIC_REGISTRY. An executable host also has to export its symbols, such as
    ///       by linking with \c -rdynamic on ELF platforms.
    /// \note A registration goes away when the object holding it is destroyed, which for a plugin
    ///       means the loader really did unload it. A platform loader may retain a module even
    ///       after reporting a successful close.
    /// \warning Neither joining nor leaving the list is synchronized, and leaving it races with
    ///          anyone iterating. Loading and unloading a shared library is not necessarily
    ///          single threaded, so serialize that yourself.
    /// \warning Leaving the list does not make an entry safe to keep. Its name and constructor
    ///          both live in the module that registered it, as does whatever \c instantiate()
    ///          built, so those have to be gone before it unloads.
    /// \warning The names are not copied. Register with a literal, or with something that
    ///          outlives the program.
    ///
    /// \sa DynamicRegistry, for the entries that are not known at link time
    template <class T, class Traits = static_registry_traits<T>>
    class StaticRegistry {
    public:
        using type = T;
        using traits_type = Traits;
        using result_type = typename traits_type::result_type;

        /// One registered implementation: what it is called, and how to make one.
        class Entry {
        public:
            Entry(std::string_view name, std::string_view desc, result_type (*ctor)())
                : _name(name), _desc(desc), _ctor(ctor) {
            }

            std::string_view name() const {
                return _name;
            }
            std::string_view desc() const {
                return _desc;
            }

            /// Makes one. A fresh object every call, so the registry holds descriptions rather
            /// than instances.
            result_type instantiate() const {
                return _ctor();
            }

        private:
            std::string_view _name;
            std::string_view _desc;
            result_type (*_ctor)();
        };

        class Iterator;

        /// A link in the list. Lives inside the Add object that registered it, so the registry
        /// itself never allocates.
        ///
        /// Doubly linked so that a registration can take itself out in constant time without
        /// walking the list for its predecessor.
        class Node {
        public:
            explicit Node(const Entry &entry) : _entry(entry) {
            }

        private:
            friend class StaticRegistry;
            friend class Iterator;

            Node *_next = nullptr;
            Node *_prev = nullptr;
            const Entry &_entry;
        };

        class Iterator {
        public:
            using iterator_category = std::forward_iterator_tag;
            using value_type = Entry;
            using difference_type = std::ptrdiff_t;
            using pointer = const Entry *;
            using reference = const Entry &;

            explicit Iterator(const Node *node = nullptr) : _node(node) {
            }

            reference operator*() const {
                return _node->_entry;
            }
            pointer operator->() const {
                return &_node->_entry;
            }

            Iterator &operator++() {
                _node = _node->_next;
                return *this;
            }
            Iterator operator++(int) {
                Iterator r = *this;
                ++*this;
                return r;
            }

            bool operator==(const Iterator &RHS) const {
                return _node == RHS._node;
            }
            bool operator!=(const Iterator &RHS) const {
                return _node != RHS._node;
            }

        private:
            const Node *_node;
        };

        /// What entries() hands back, so the registry reads in a range-for.
        class Range {
        public:
            Iterator begin() const {
                return StaticRegistry::begin();
            }
            Iterator end() const {
                return Iterator(nullptr);
            }
        };

        static Iterator begin() {
            return Iterator(storage().head);
        }
        static Iterator end() {
            return Iterator(nullptr);
        }
        static Range entries() {
            return Range();
        }

        /// Appends \a node, keeping registration order. Called by Add, and by a plugin against
        /// the host's copy of this symbol.
        static void add_node(Node *node) {
            auto &data = storage();
            node->_prev = data.tail;
            if (data.tail) {
                data.tail->_next = node;
            } else {
                data.head = node;
            }
            data.tail = node;
        }

        /// Takes \a node back out, which is what a registration does when it is destroyed.
        static void remove_node(Node *node) {
            auto &data = storage();
            if (node->_prev) {
                node->_prev->_next = node->_next;
            } else {
                data.head = node->_next;
            }
            if (node->_next) {
                node->_next->_prev = node->_prev;
            } else {
                data.tail = node->_prev;
            }
            node->_next = nullptr;
            node->_prev = nullptr;
        }

        /// Registers \a V, default constructed, for as long as this object lives. For a static
        /// object that is the whole program.
        ///
        /// \code
        ///   static CodecRegistry::Add<FlacCodec> x("flac", "Free Lossless Audio Codec");
        /// \endcode
        ///
        /// \sa AddFactory, for an implementation that is not default constructible
        template <class V>
        class Add {
        public:
            Add(std::string_view name, std::string_view desc)
                : _entry(name, desc, &construct), _node(_entry) {
                add_node(&_node);
            }

            ~Add() {
                remove_node(&_node);
            }

        private:
            static result_type construct() {
                return traits_type::template construct<V>();
            }

            Entry _entry;
            Node _node;

            STDC_DISABLE_COPY_MOVE(Add)
        };

        /// Registers something built the way \a factory says, for the implementations that take
        /// constructor arguments, come from a factory function, or are not one type at all.
        ///
        /// A lambda that captures nothing converts to the function pointer this takes, so the
        /// arguments are baked in at the call site with no allocation and nothing to spell out:
        ///
        /// \code
        ///   static CodecRegistry::AddFactory x(
        ///       "mp3", "MPEG Layer III",
        ///       []() -> std::unique_ptr<Codec> { return std::make_unique<Mp3Codec>(44100, 2); });
        /// \endcode
        ///
        /// \note The lambda has to name the base in its return type, \c std::unique_ptr<Codec>
        ///       above. One returning \c std::unique_ptr<Mp3Codec> is a different function type
        ///       and will not convert, even though the pointers themselves would.
        /// \note Only values known where the lambda is written can go in it. Capturing something
        ///       decided at run time makes a closure, which is no longer a function pointer.
        ///       DynamicRegistry holds a \c std::function and takes those.
        class AddFactory {
        public:
            AddFactory(std::string_view name, std::string_view desc, result_type (*factory)())
                : _entry(name, desc, factory), _node(_entry) {
                add_node(&_node);
            }

            ~AddFactory() {
                remove_node(&_node);
            }

        private:
            Entry _entry;
            Node _node;

            STDC_DISABLE_COPY_MOVE(AddFactory)
        };

        StaticRegistry() = delete;

    private:
        struct Storage {
            Node *head = nullptr;
            Node *tail = nullptr;
        };

        static Storage &storage();
    };

    /// @}
}

/// Declares the exported storage for a \c StaticRegistry over \a TYPE.
///
/// Put this in a public header after any specialization of \c static_registry_traits for
/// \a TYPE. Put \c STDC_STATIC_REGISTRY in one translation unit of the module that owns the
/// registry. \a EXPORT must select export while building that module and import while using it.
#define STDC_DECLARE_EXPORTED_STATIC_REGISTRY(TYPE, EXPORT)                                        \
    template <>                                                                                    \
    EXPORT                                                                                         \
        typename ::stdc::StaticRegistry<TYPE>::Storage & ::stdc::StaticRegistry<TYPE>::storage();

/// Declares the storage for a \c StaticRegistry over \a TYPE without an export decoration.
#define STDC_DECLARE_STATIC_REGISTRY(TYPE) STDC_DECLARE_EXPORTED_STATIC_REGISTRY(TYPE, )

/// Defines the storage for a \c StaticRegistry over \a TYPE.
///
/// Put this in exactly one translation unit of the module that owns the registry. Put the
/// corresponding declaration in a public header when registrations can come from another
/// module. The macro must be used at global scope.
#define STDC_STATIC_REGISTRY(TYPE)                                                                 \
    template <>                                                                                    \
    typename ::stdc::StaticRegistry<TYPE>::Storage & ::stdc::StaticRegistry<TYPE>::storage() {     \
        static Storage storage;                                                                    \
        return storage;                                                                            \
    }

#endif // STDCORELIB_STATICREGISTRY_H
