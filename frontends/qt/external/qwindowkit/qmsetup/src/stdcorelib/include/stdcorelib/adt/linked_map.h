// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_LINKED_MAP_H
#define STDCORELIB_LINKED_MAP_H

#include <cassert>
#include <cstddef>
#include <initializer_list>
#include <list>
#include <map>
#include <memory>
#include <string>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <unordered_map>
#include <utility>
#include <vector>

#include <stdcorelib/stdc_global.h>

#ifdef QT_CORE_LIB
#  include <QHashFunctions>
#  include <QList>
#  include <QString>
#  include <QStringView>
#  include <QVector>
#endif

namespace stdc {

    /// \addtogroup containers
    /// @{

    /// Associates an owning key type with a non-owning view type.
    template <class K>
    struct linked_map_view_traits {};

    namespace detail {

        template <class>
        struct dependent_false : std::false_type {};

        template <class T, class = void>
        struct has_reserve : std::false_type {};

        template <class T>
        struct has_reserve<T, std::void_t<decltype(std::declval<T &>().reserve(
                                  std::declval<typename T::size_type>()))>> : std::true_type {};

        template <class T, class = void>
        struct has_capacity : std::false_type {};

        template <class T>
        struct has_capacity<T, std::void_t<decltype(std::declval<const T &>().capacity())>>
            : std::true_type {};

    }

    /// Hashes an index key with its standard hash function.
    struct linked_map_hash {
        using is_transparent = void;

        template <class Key>
        size_t operator()(const Key &key) const noexcept(noexcept(std::hash<Key>()(key))) {
            return std::hash<Key>()(key);
        }

#ifdef QT_CORE_LIB
        size_t operator()(QStringView key) const noexcept {
            return qHash(key);
        }
#endif
    };

    /// Stores a copy of each key in the lookup index.
    template <class K>
    struct linked_map_key_traits {
        using key_type = K;
        using index_key_type = K;

        static const index_key_type &index_key(const key_type &key) noexcept {
            return key;
        }
    };

    namespace detail {

        template <class K, class = void>
        struct linked_map_default_key_traits {
            using type = linked_map_key_traits<K>;
        };

        template <class K>
        struct linked_map_default_key_traits<
            K, std::void_t<typename linked_map_view_traits<K>::index_key_type>> {
            using type = linked_map_view_traits<K>;
        };

    }

    /// Configures an unordered lookup index independently of its key representation.
    template <class Hash = linked_map_hash, class KeyEqual = std::equal_to<>,
              class Allocator = std::allocator<std::byte>>
    struct linked_map_unordered_traits {
        template <class Value>
        using allocator_type =
            typename std::allocator_traits<Allocator>::template rebind_alloc<Value>;

        template <class Key, class Mapped, class BaseAllocator>
        using map_type =
            std::unordered_map<Key, Mapped, Hash, KeyEqual,
                               typename std::allocator_traits<BaseAllocator>::template rebind_alloc<
                                   std::pair<const Key, Mapped>>>;

        template <class Map, class BaseAllocator>
        static Map make(const BaseAllocator &allocator) {
            using map_allocator = typename Map::allocator_type;
            return Map(0, typename Map::hasher(), typename Map::key_equal(),
                       map_allocator(allocator));
        }

        template <class Map, class BaseAllocator>
        static Map copy_configuration(const Map &RHS, const BaseAllocator &allocator) {
            using map_allocator = typename Map::allocator_type;
            Map result(RHS.bucket_count(), RHS.hash_function(), RHS.key_eq(),
                       map_allocator(allocator));
            result.max_load_factor(RHS.max_load_factor());
            return result;
        }
    };

    /// Configures an ordered lookup index independently of its key representation.
    template <class Compare = std::less<>, class Allocator = std::allocator<std::byte>>
    struct linked_map_ordered_traits {
        template <class Value>
        using allocator_type =
            typename std::allocator_traits<Allocator>::template rebind_alloc<Value>;

        template <class Key, class Mapped, class BaseAllocator>
        using map_type =
            std::map<Key, Mapped, Compare,
                     typename std::allocator_traits<BaseAllocator>::template rebind_alloc<
                         std::pair<const Key, Mapped>>>;

        template <class Map, class BaseAllocator>
        static Map make(const BaseAllocator &allocator) {
            using map_allocator = typename Map::allocator_type;
            return Map(typename Map::key_compare(), map_allocator(allocator));
        }

        template <class Map, class BaseAllocator>
        static Map copy_configuration(const Map &RHS, const BaseAllocator &allocator) {
            using map_allocator = typename Map::allocator_type;
            return Map(RHS.key_comp(), map_allocator(allocator));
        }
    };

    /// Combines an index container policy with an independently reusable key representation.
    template <class MapTraits, class KeyTraits>
    struct linked_map_index_traits {
        using key_type = typename KeyTraits::key_type;
        using index_key_type = typename KeyTraits::index_key_type;

        template <class Value>
        using allocator_type = typename MapTraits::template allocator_type<Value>;

        template <class Mapped, class BaseAllocator>
        using map_type =
            typename MapTraits::template map_type<index_key_type, Mapped, BaseAllocator>;

        static decltype(auto)
            index_key(const key_type &key) noexcept(noexcept(KeyTraits::index_key(key))) {
            return KeyTraits::index_key(key);
        }

        template <class Map, class BaseAllocator>
        static Map make(const BaseAllocator &allocator) {
            return MapTraits::template make<Map>(allocator);
        }

        template <class Map, class BaseAllocator>
        static Map copy_configuration(const Map &RHS, const BaseAllocator &allocator) {
            return MapTraits::template copy_configuration<Map>(RHS, allocator);
        }
    };

    /// An associative container that preserves insertion order.
    ///
    /// Values live in a list so their order and iterators remain stable. An independently
    /// configured associative container indexes the list. Its key traits decide whether the
    /// index owns another key or refers to the key in the list node.
    template <class K, class V, class MapTraits = linked_map_unordered_traits<>,
              class KeyTraits = typename detail::linked_map_default_key_traits<K>::type>
    class linked_map {
    public:
        using key_type = K;
        using mapped_type = V;
        using value_type = std::pair<const K, V>;

    private:
        using index_traits = linked_map_index_traits<MapTraits, KeyTraits>;
        static_assert(std::is_same_v<K, typename index_traits::key_type>,
                      "linked_map key and index key traits must have the same key type");

        using allocator_type_impl = typename index_traits::template allocator_type<value_type>;
        using allocator_traits = std::allocator_traits<allocator_type_impl>;

    public:
        using list_allocator_type = typename allocator_traits::template rebind_alloc<value_type>;
        using list_type = std::list<value_type, list_allocator_type>;

        using allocator_type = allocator_type_impl;
        using iterator = typename list_type::iterator;
        using const_iterator = typename list_type::const_iterator;
        using reverse_iterator = typename list_type::reverse_iterator;
        using const_reverse_iterator = typename list_type::const_reverse_iterator;
        using size_type = typename list_type::size_type;
        using difference_type = typename list_type::difference_type;
        using reference = value_type &;
        using const_reference = const value_type &;
        using pointer = typename list_type::pointer;
        using const_pointer = typename list_type::const_pointer;

    public:
        using map_type = typename index_traits::template map_type<iterator, allocator_type>;

        linked_map() : linked_map(allocator_type()) {
        }

        explicit linked_map(const allocator_type &allocator)
            : _list(list_allocator_type(allocator)),
              _map(index_traits::template make<map_type>(allocator)) {
        }

        linked_map(const linked_map &RHS)
            : linked_map(RHS, allocator_traits::select_on_container_copy_construction(
                                  RHS.get_allocator())) {
        }

        linked_map(linked_map &&RHS) = default;

        linked_map &operator=(const linked_map &RHS) {
            if (this == &RHS) {
                return *this;
            }
            linked_map replacement(RHS, get_allocator());
            swap(replacement);
            return *this;
        }

        linked_map &
            operator=(linked_map &&RHS) noexcept(allocator_traits::is_always_equal::value &&
                                                 std::is_nothrow_move_assignable_v<map_type>) {
            if (this == &RHS) {
                return *this;
            }

            if constexpr (allocator_traits::is_always_equal::value) {
                move_from_equal_allocator(RHS);
            } else if (get_allocator() == RHS.get_allocator()) {
                move_from_equal_allocator(RHS);
            } else {
                linked_map replacement(empty_copy, RHS, get_allocator());
                for (auto &item : RHS._list) {
                    replacement.append(item.first, std::move(item.second));
                }
                swap(replacement);
                RHS.clear();
            }
            return *this;
        }

        linked_map(std::initializer_list<value_type> list) : linked_map(list.begin(), list.end()) {
        }

        template <class InputIterator>
        linked_map(InputIterator first, InputIterator last) : linked_map() {
            for (; first != last; ++first) {
                auto &&item = *first;
                append(item.first, std::forward<decltype((item.second))>(item.second));
            }
        }

        bool operator==(const linked_map &RHS) const {
            return _list == RHS._list;
        }

        bool operator!=(const linked_map &RHS) const {
            return !(*this == RHS);
        }

        void swap(linked_map &RHS) noexcept(
            noexcept(std::declval<list_type &>().swap(std::declval<list_type &>())) &&
            noexcept(std::declval<map_type &>().swap(std::declval<map_type &>()))) {
            assert(allocator_traits::propagate_on_container_swap::value ||
                   get_allocator() == RHS.get_allocator());
            _map.swap(RHS._map);
            _list.swap(RHS._list);
        }

        std::pair<iterator, bool> append(const K &key, const V &value) {
            return emplace_impl(_list.end(), key, value);
        }

        std::pair<iterator, bool> append(const K &key, V &&value) {
            return emplace_impl(_list.end(), key, std::move(value));
        }

        std::pair<iterator, bool> prepend(const K &key, const V &value) {
            return emplace_impl(_list.begin(), key, value);
        }

        std::pair<iterator, bool> prepend(const K &key, V &&value) {
            return emplace_impl(_list.begin(), key, std::move(value));
        }

        std::pair<iterator, bool> insert(const_iterator position, const K &key, const V &value) {
            return emplace_impl(position, key, value);
        }

        std::pair<iterator, bool> insert(const_iterator position, const K &key, V &&value) {
            return emplace_impl(position, key, std::move(value));
        }

        template <class... Args>
        std::pair<iterator, bool> try_emplace(const K &key, Args &&...args) {
            return emplace_impl(_list.end(), key, std::forward<Args>(args)...);
        }

        V &operator[](const K &key) {
            return try_emplace(key).first->second;
        }

        bool remove(const K &key) {
            auto found = _map.find(index_traits::index_key(key));
            if (found == _map.end()) {
                return false;
            }
            auto position = found->second;
            _map.erase(found);
            _list.erase(position);
            return true;
        }

        size_type erase(const K &key) {
            return remove(key) ? 1 : 0;
        }

        iterator erase(iterator position) {
            return erase(const_iterator(position));
        }

        iterator erase(const_iterator position) {
            assert(position != _list.end());
            auto found = _map.find(index_traits::index_key(position->first));
            assert(found != _map.end() && const_iterator(found->second) == position);
            _map.erase(found);
            return _list.erase(position);
        }

        iterator find(const K &key) {
            auto found = _map.find(index_traits::index_key(key));
            return found == _map.end() ? end() : found->second;
        }

        const_iterator find(const K &key) const {
            auto found = _map.find(index_traits::index_key(key));
            return found == _map.end() ? cend() : const_iterator(found->second);
        }

        V value(const K &key) const {
            auto found = _map.find(index_traits::index_key(key));
            return found == _map.end() ? V() : found->second->second;
        }

        V value(const K &key, const V &defaultValue) const {
            auto found = _map.find(index_traits::index_key(key));
            return found == _map.end() ? defaultValue : found->second->second;
        }

        iterator begin() noexcept {
            return _list.begin();
        }

        const_iterator begin() const noexcept {
            return _list.begin();
        }

        const_iterator cbegin() const noexcept {
            return _list.cbegin();
        }

        iterator end() noexcept {
            return _list.end();
        }

        const_iterator end() const noexcept {
            return _list.end();
        }

        const_iterator cend() const noexcept {
            return _list.cend();
        }

        reverse_iterator rbegin() noexcept {
            return _list.rbegin();
        }

        const_reverse_iterator rbegin() const noexcept {
            return _list.rbegin();
        }

        const_reverse_iterator crbegin() const noexcept {
            return _list.crbegin();
        }

        reverse_iterator rend() noexcept {
            return _list.rend();
        }

        const_reverse_iterator rend() const noexcept {
            return _list.rend();
        }

        const_reverse_iterator crend() const noexcept {
            return _list.crend();
        }

        bool contains(const K &key) const {
            return _map.find(index_traits::index_key(key)) != _map.end();
        }

        size_type size() const noexcept {
            return _list.size();
        }

        bool empty() const noexcept {
            return _list.empty();
        }

        void clear() noexcept {
            _map.clear();
            _list.clear();
        }

        allocator_type get_allocator() const noexcept {
            return allocator_type(_list.get_allocator());
        }

        std::vector<K> keys() const {
            std::vector<K> result;
            result.reserve(_list.size());
            for (const auto &item : _list) {
                result.push_back(item.first);
            }
            return result;
        }

#ifdef QT_CORE_LIB
        QList<K> keys_qlist() const {
            QList<K> result;
            result.reserve(_list.size());
            for (const auto &item : _list) {
                result.push_back(item.first);
            }
            return result;
        }

        QVector<K> keys_qvector() const {
            QVector<K> result;
            result.reserve(_list.size());
            for (const auto &item : _list) {
                result.push_back(item.first);
            }
            return result;
        }
#endif

        std::vector<V> values() const {
            std::vector<V> result;
            result.reserve(_list.size());
            for (const auto &item : _list) {
                result.push_back(item.second);
            }
            return result;
        }

#ifdef QT_CORE_LIB
        QList<V> values_qlist() const {
            QList<V> result;
            result.reserve(_list.size());
            for (const auto &item : _list) {
                result.push_back(item.second);
            }
            return result;
        }

        QVector<V> values_qvector() const {
            QVector<V> result;
            result.reserve(_list.size());
            for (const auto &item : _list) {
                result.push_back(item.second);
            }
            return result;
        }
#endif

        size_type capacity() const {
            if constexpr (detail::has_capacity<map_type>::value) {
                return static_cast<size_type>(_map.capacity());
            } else {
                static_assert(detail::dependent_false<map_type>::value,
                              "linked_map::capacity() is not supported by the index type");
                return 0;
            }
        }

        void reserve(size_type size) {
            if constexpr (detail::has_reserve<map_type>::value) {
                _map.reserve(size);
            } else {
                static_assert(detail::dependent_false<map_type>::value,
                              "linked_map::reserve() is not supported by the index type");
            }
        }

    private:
        struct empty_copy_t {};
        static constexpr empty_copy_t empty_copy{};

        linked_map(empty_copy_t, const linked_map &RHS, const allocator_type &allocator)
            : _list(list_allocator_type(allocator)),
              _map(index_traits::template copy_configuration<map_type>(RHS._map, allocator)) {
        }

        linked_map(const linked_map &RHS, const allocator_type &allocator)
            : linked_map(empty_copy, RHS, allocator) {
            for (const auto &item : RHS._list) {
                append(item.first, item.second);
            }
        }

        template <class... Args>
        std::pair<iterator, bool> emplace_impl(const_iterator position, const K &key,
                                               Args &&...args) {
            auto found = _map.find(index_traits::index_key(key));
            if (found != _map.end()) {
                return {found->second, false};
            }

            auto inserted =
                _list.emplace(position, std::piecewise_construct, std::forward_as_tuple(key),
                              std::forward_as_tuple(std::forward<Args>(args)...));
#ifdef STDC_HAS_EXCEPTIONS
            try {
#endif
                auto indexed = _map.emplace(index_traits::index_key(inserted->first), inserted);
                if (!indexed.second) {
                    _list.erase(inserted);
                    return {indexed.first->second, false};
                }
                return {indexed.first->second, true};
#ifdef STDC_HAS_EXCEPTIONS
            } catch (...) {
                _list.erase(inserted);
                throw;
            }
#endif
        }

        void move_from_equal_allocator(linked_map &RHS) {
            _map = std::move(RHS._map);
            _list.clear();
            _list.splice(_list.end(), RHS._list);
        }

        list_type _list;
        map_type _map;
    };

    /// @}
}

/// Declares the view type used by the default linked map index for the given key type.
#define STDC_DECLARE_LINKED_MAP_KEY_VIEW(Key, View)                                                \
    template <>                                                                                    \
    struct stdc::linked_map_view_traits<Key> {                                                     \
        using key_type = Key;                                                                      \
        using index_key_type = View;                                                               \
                                                                                                   \
        static index_key_type index_key(const key_type &key) noexcept(                             \
            std::is_nothrow_constructible_v<index_key_type, const key_type &>) {                   \
            return index_key_type(key);                                                            \
        }                                                                                          \
    };

STDC_DECLARE_LINKED_MAP_KEY_VIEW(std::string, std::string_view)
STDC_DECLARE_LINKED_MAP_KEY_VIEW(std::wstring, std::wstring_view)

#ifdef QT_CORE_LIB
STDC_DECLARE_LINKED_MAP_KEY_VIEW(QString, QStringView)
#endif

#endif // STDCORELIB_LINKED_MAP_H
