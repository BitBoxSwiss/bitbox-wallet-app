// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_REGISTRY_H
#define STDCORELIB_REGISTRY_H

#include "stdc_windows.h"

#include <string>
#include <vector>
#include <memory>
#include <cstdint>
#include <system_error>
#include <stdexcept>
#include <optional>

#include <stdcorelib/stdc_global.h>
#include <stdcorelib/stlextra/iterator.h>
#include <stdcorelib/adt/array_view.h>

namespace stdc::windows {

    /// \addtogroup platform
    /// @{

    /// A registry value together with its type, holding the data rather than pointing at it.
    ///
    /// A value that failed to load has type \c Invalid, which isValid() reports.
    ///
    /// \warning The \c toXxx() readers do not convert between types. Reading against the wrong
    ///          one hands back a default, meaning 0 or an empty string, and says nothing went
    ///          wrong, so check with isInt64(), isString() and the rest first.
    class STDC_EXPORT RegValue {
    public:
        enum Type {
            Invalid = -1,
            None = REG_NONE,
            Binary = REG_BINARY,
            Int32 = REG_DWORD, // DWORD
            Int64 = REG_QWORD, // QWORD
            String = REG_SZ,
            StringList = REG_MULTI_SZ, // MULTI_STRING
            ExpandString = REG_EXPAND_SZ,
            Link = REG_LINK,
        };

        RegValue(Type type = None);
        RegValue(const array_view<uint8_t> &data);
        inline RegValue(const uint8_t *data, int size);
        RegValue(std::vector<uint8_t> &&data);
        RegValue(int32_t value);
        inline RegValue(uint32_t value);
        RegValue(int64_t value);
        inline RegValue(uint64_t value);
        RegValue(const std::wstring &value, Type type = String);
        RegValue(std::wstring &&value, Type type = String);
        RegValue(const wchar_t *value, int size = -1, Type type = String);
        RegValue(const array_view<std::wstring> &value);
        RegValue(std::vector<std::wstring> &&value);
        inline RegValue(std::initializer_list<std::wstring> value)
            : RegValue(array_view<std::wstring>(value)) {
        }
        RegValue(const void *data, int type); // data shouldn't be deleted before RegValue destructs
        ~RegValue();

        RegValue(const RegValue &RHS);
        RegValue(RegValue &&RHS) noexcept;
        RegValue &operator=(const RegValue &RHS);
        RegValue &operator=(RegValue &&RHS) noexcept;

    public:
        inline int type() const {
            return t;
        }

        /// The stored bytes, or an empty vector when this is not binary.
        const std::vector<uint8_t> &toBinary() const;
        int32_t toInt32() const;
        inline uint32_t toUInt32() const;
        int64_t toInt64() const;
        inline uint64_t toUInt64() const;
        const std::wstring &toString() const;
        /// The stored strings, or an empty vector when this is not a string list.
        const std::vector<std::wstring> &toStringList() const;
        std::wstring toExpandString() const;
        std::wstring toLink() const;

        inline bool isValid() const {
            return type() != Invalid;
        }
        inline bool isNone() const {
            return type() == None;
        }
        inline bool isBinary() const {
            return type() == Binary;
        }
        inline bool isInt32() const {
            return type() == Int32;
        }
        inline bool isInt64() const {
            return type() == Int64;
        }
        inline bool isString() const {
            return type() == String;
        }
        inline bool isStringList() const {
            return type() == StringList;
        }
        inline bool isExpandString() const {
            return type() == ExpandString;
        }
        inline bool isLink() const {
            return type() == Link;
        }

        inline const void *dataPointer() const {
            return d.p;
        }

        bool operator==(const RegValue &RHS) const;
        inline bool operator!=(const RegValue &RHS) const {
            return !(*this == RHS);
        }

    protected:
        int t;
        union {
            int32_t dw;
            int64_t qw;
            const void *p;
        } d;
        struct Comp;
        std::shared_ptr<Comp> comp;
    };

    class STDC_EXPORT RegKey {
    public:
        enum DesiredAccess {
            DA_Delete = DELETE,
            DA_ReadControl = READ_CONTROL,
            DA_WriteDAC = WRITE_DAC,
            DA_WriteOwner = WRITE_OWNER,
            DA_AllAccess = KEY_ALL_ACCESS,
            DA_CreateSubKey = KEY_CREATE_SUB_KEY,
            DA_EnumerateSubKeys = KEY_ENUMERATE_SUB_KEYS,
            DA_Notify = KEY_NOTIFY,
            DA_QueryValue = KEY_QUERY_VALUE,
            DA_SetValue = KEY_SET_VALUE,
            DA_Wow6432 = KEY_WOW64_32KEY,
            DA_Wow6464 = KEY_WOW64_64KEY,
            DA_Read = KEY_READ,
            DA_Write = KEY_WRITE,
            DA_Execute = KEY_EXECUTE,
        };

        enum CreateOption {
            CO_BackupRestore = REG_OPTION_BACKUP_RESTORE,
            CO_NonVolatile = REG_OPTION_NON_VOLATILE,
            CO_Volatile = REG_OPTION_VOLATILE,
        };

        enum SaveFlag {
            SF_StandardFormat = REG_STANDARD_FORMAT,
            SF_LatestFormat = REG_LATEST_FORMAT,
            SF_NoCompression = REG_NO_COMPRESSION,
        };

        enum NotifyFilter {
            NF_ChangeName = REG_NOTIFY_CHANGE_NAME,
            NF_ChangeAttributes = REG_NOTIFY_CHANGE_ATTRIBUTES,
            NF_ChangeLastSet = REG_NOTIFY_CHANGE_LAST_SET,
            NF_ChangeSecurity = REG_NOTIFY_CHANGE_SECURITY,
            NF_ThreadAgnostic = REG_NOTIFY_THREAD_AGNOSTIC,
            NF_LegalChangeFilter = REG_LEGAL_CHANGE_FILTER,
        };

        enum ReservedKey {
            RK_ClassesRoot = 1,
            RK_CurrentUser,
            RK_LocalMachine,
            RK_Users,
            RK_CurrentConfig,
        };

        struct KeyData {
            std::wstring name;
            FILETIME lastWriteTime{};
        };

        struct ValueData {
            std::wstring name;
            RegValue value;
        };

        /// Adopts an existing \c HKEY.
        ///
        /// \param hkey the handle to wrap, or null for an invalid key
        /// \param owns whether the destructor closes it, so wrapping a handle somebody else
        ///        manages is safe
        inline RegKey(HKEY hkey = nullptr, bool owns = false) noexcept : _hkey(hkey), _owns(owns) {
        }

        /// One of the predefined roots.
        ///
        /// \note These are never closed, since they do not belong to us.
        RegKey(ReservedKey key) noexcept;

        ~RegKey();

        RegKey(RegKey &&RHS) noexcept;
        RegKey &operator=(RegKey &&RHS) noexcept;

    public:
        inline HKEY handle() const {
            return _hkey;
        }

        /// Hands the handle over and gives up ownership.
        ///
        /// \return the handle, which the caller is now responsible for closing
        inline HKEY take() {
            HKEY hkey = _hkey;
            _hkey = nullptr;
            _owns = false;
            return hkey;
        }

        inline bool isValid() const {
            return _hkey != nullptr;
        }

        /// Opens a subkey below this one.
        ///
        /// \param path the subkey, relative to this one
        /// \param access a bitwise or of \ref DesiredAccess values
        /// \return the subkey, owning its handle and closing it when it goes out of scope. Check
        ///         isValid() to see whether it opened.
        /// \throws std::system_error from the overload that takes no \a ec
        /// \note Every operation on this class comes in these two forms. The one taking an \a ec
        ///       sets it to the failure reason and is \c noexcept, the one without throws. Only
        ///       the \a ec form is there in a translation unit compiled without exceptions.
#ifdef STDC_HAS_EXCEPTIONS
        inline RegKey open(const std::wstring &path, int access = DA_Read);
#endif
        RegKey open(const std::wstring &path, std::error_code &ec, int access = DA_Read) noexcept;

#ifdef STDC_HAS_EXCEPTIONS
        inline RegKey create(const std::wstring &path, int access = DA_Read | DA_Write,
                             int options = CO_NonVolatile, LPSECURITY_ATTRIBUTES sa = nullptr,
                             bool *exists = nullptr);
#endif
        RegKey create(const std::wstring &path, std::error_code &ec,
                      int access = DA_Read | DA_Write, int options = CO_NonVolatile,
                      LPSECURITY_ATTRIBUTES sa = nullptr, bool *exists = nullptr) noexcept;

#ifdef STDC_HAS_EXCEPTIONS
        inline bool close();
#endif
        bool close(std::error_code &ec) noexcept;

#ifdef STDC_HAS_EXCEPTIONS
        inline int keyCount() const;
#endif
        int keyCount(std::error_code &ec) const noexcept;
#ifdef STDC_HAS_EXCEPTIONS
        inline std::optional<KeyData> keyAt(int index) const;
#endif
        std::optional<KeyData> keyAt(int index, std::error_code &ec) const noexcept;

#ifdef STDC_HAS_EXCEPTIONS
        inline int valueCount() const;
#endif
        int valueCount(std::error_code &ec) const noexcept;
#ifdef STDC_HAS_EXCEPTIONS
        inline std::optional<ValueData> valueAt(int index, bool query = false) const;
#endif
        std::optional<ValueData> valueAt(int index, std::error_code &ec,
                                         bool query = false) const noexcept;

#ifdef STDC_HAS_EXCEPTIONS
        inline bool flush();
#endif
        bool flush(std::error_code &ec) noexcept;
#ifdef STDC_HAS_EXCEPTIONS
        inline bool save(const std::wstring &filename, LPSECURITY_ATTRIBUTES sa = nullptr,
                         int flags = SF_StandardFormat);
#endif
        bool save(const std::wstring &filename, std::error_code &ec,
                  LPSECURITY_ATTRIBUTES sa = nullptr, int flags = SF_StandardFormat) noexcept;

#ifdef STDC_HAS_EXCEPTIONS
        inline bool hasKey(const std::wstring &path) const;
#endif
        bool hasKey(const std::wstring &path, std::error_code &ec) const noexcept;
#ifdef STDC_HAS_EXCEPTIONS
        inline bool hasValue(const std::wstring &name) const;
#endif
        bool hasValue(const std::wstring &name, std::error_code &ec) const noexcept;

#ifdef STDC_HAS_EXCEPTIONS
        inline RegValue value(const std::wstring &name) const;
#endif
        RegValue value(const std::wstring &name, std::error_code &ec) const noexcept;
#ifdef STDC_HAS_EXCEPTIONS
        inline RegValue valueOr(const std::wstring &name,
                                const RegValue &defaultValue = RegValue::Invalid) const;
#endif
        inline RegValue valueOr(const std::wstring &name, std::error_code &ec,
                                const RegValue &defaultValue = RegValue::Invalid) const noexcept;
#ifdef STDC_HAS_EXCEPTIONS
        inline bool setValue(const std::wstring &name, const RegValue &value);
#endif
        bool setValue(const std::wstring &name, const RegValue &value,
                      std::error_code &ec) noexcept;

#ifdef STDC_HAS_EXCEPTIONS
        inline bool removeKey(const std::wstring &path);
#endif
        bool removeKey(const std::wstring &path, std::error_code &ec) noexcept;
#ifdef STDC_HAS_EXCEPTIONS
        inline bool removeValue(const std::wstring &name);
#endif
        bool removeValue(const std::wstring &name, std::error_code &ec) noexcept;
#ifdef STDC_HAS_EXCEPTIONS
        inline bool removeAll();
#endif
        bool removeAll(std::error_code &ec) noexcept;

#ifdef STDC_HAS_EXCEPTIONS
        inline bool notify(bool watchSubtree = false,
                           int notifyFilter = NF_ChangeName | NF_ChangeAttributes,
                           HANDLE event = nullptr, bool async = false);
#endif
        bool notify(std::error_code &ec, bool watchSubtree = false,
                    int notifyFilter = NF_ChangeName | NF_ChangeAttributes, HANDLE event = nullptr,
                    bool async = false) noexcept;

        class key_enumerator;

        class key_iterator {
        public:
            // FIXME: This does not implement the complete random access iterator interface.
            using iterator_category = std::random_access_iterator_tag;
            using value_type = KeyData;
            using difference_type = int;
            using pointer = const value_type *;
            using reference = const value_type &;

            // default constructor creates an invalid iterator
            inline key_iterator() noexcept : _key(nullptr), _ec(nullptr), _index(0), _count(0) {
            }

            inline reference operator*() const noexcept {
                return _data.value();
            }

            inline pointer operator->() const noexcept {
                return &_data.value();
            }

            inline key_iterator &operator++() {
                ++_index;
                fetch();
                return *this;
            }

            inline key_iterator operator++(int) {
                auto tmp = *this;
                ++*this;
                return tmp;
            }

            inline key_iterator &operator+=(int off) {
                _index += off;
                fetch();
                return *this;
            }

            inline key_iterator &operator--() {
                --_index;
                fetch();
                return *this;
            }

            inline key_iterator operator--(int) {
                auto tmp = *this;
                --*this;
                return tmp;
            }

            inline key_iterator &operator-=(int off) {
                _index -= off;
                fetch();
                return *this;
            }

            inline bool operator==(const key_iterator &RHS) const noexcept {
                return !_error_occurred && _index == RHS._index;
            }

            inline bool operator!=(const key_iterator &RHS) const noexcept {
                return !_error_occurred && _index != RHS._index;
            }

            inline bool operator<(const key_iterator &RHS) const {
                return !_error_occurred && _index < RHS._index;
            }

            inline bool operator<=(const key_iterator &RHS) const {
                return !_error_occurred && _index <= RHS._index;
            }

            inline bool operator>(const key_iterator &RHS) const {
                return !_error_occurred && _index > RHS._index;
            }

            inline bool operator>=(const key_iterator &RHS) const {
                return !_error_occurred && _index >= RHS._index;
            }

        private:
            // Not noexcept: fetch() reads the first entry, and the form with no \a ec reports a
            // failure by throwing.
            inline key_iterator(const RegKey *key, int index, int count, std::error_code *ec)
                : _key(key), _ec(ec), _index(index), _count(count) {
                fetch();
            }

            inline void fetch() const {
                if (_index >= _count || _index < 0)
                    return;
#ifdef STDC_HAS_EXCEPTIONS
                if (!_ec) {
                    _data = _key->keyAt(_index);
                    return;
                }
#endif
                _data = _key->keyAt(_index, *_ec);
                if (_ec->value() != ERROR_SUCCESS) {
                    _error_occurred = true;
                }
            }

            const RegKey *_key;
            mutable std::error_code *_ec;
            mutable bool _error_occurred = false;
            mutable int _index;
            int _count;
            mutable std::optional<value_type> _data;

            friend class key_enumerator;
        };

        using reverse_key_iterator = reverse_iterator<key_iterator>;

        class key_enumerator {
        public:
#ifdef STDC_HAS_EXCEPTIONS
            inline explicit key_enumerator(const RegKey *key)
                : _key(key), _ec(nullptr), _count(_key->keyCount()) {
            }
#endif
            inline key_enumerator(const RegKey *key, std::error_code &ec)
                : _key(key), _ec(&ec), _count(_key->keyCount(ec)) {
            }
            inline key_iterator begin() const {
                return key_iterator(_key, 0, _count, _ec);
            }
            inline key_iterator end() const {
                return key_iterator(_key, _count, _count, _ec);
            }
            inline reverse_key_iterator rbegin() const {
                return reverse_key_iterator(end());
            }
            inline reverse_key_iterator rend() const {
                return reverse_key_iterator(begin());
            }

        private:
            const RegKey *_key;
            std::error_code *_ec;
            int _count;
        };

        class value_enumerator;

        class value_iterator {
        public:
            // FIXME: This does not implement the complete random access iterator interface.
            using iterator_category = std::random_access_iterator_tag;
            using value_type = ValueData;
            using difference_type = int;
            using pointer = const value_type *;
            using reference = const value_type &;

            // default constructor creates an end iterator
            inline value_iterator() noexcept
                : _key(nullptr), _ec(nullptr), _query(false), _index(0), _count(0) {
            }

            inline reference operator*() const noexcept {
                return _data.value();
            }

            inline pointer operator->() const noexcept {
                return &_data.value();
            }

            inline value_iterator &operator++() {
                ++_index;
                fetch();
                return *this;
            }

            inline value_iterator operator++(int) {
                auto tmp = *this;
                ++*this;
                return tmp;
            }

            inline value_iterator &operator+=(int off) {
                _index += off;
                fetch();
                return *this;
            }

            inline value_iterator &operator--() {
                --_index;
                fetch();
                return *this;
            }

            inline value_iterator operator--(int) {
                auto tmp = *this;
                --*this;
                return tmp;
            }

            inline value_iterator &operator-=(int off) {
                _index -= off;
                fetch();
                return *this;
            }

            inline bool operator==(const value_iterator &RHS) const noexcept {
                return !_error_occurred && _index == RHS._index;
            }

            inline bool operator!=(const value_iterator &RHS) const noexcept {
                return !_error_occurred && _index != RHS._index;
            }

            inline bool operator<(const value_iterator &RHS) const {
                return !_error_occurred && _index < RHS._index;
            }

            inline bool operator<=(const value_iterator &RHS) const {
                return !_error_occurred && _index <= RHS._index;
            }

            inline bool operator>(const value_iterator &RHS) const {
                return !_error_occurred && _index > RHS._index;
            }

            inline bool operator>=(const value_iterator &RHS) const {
                return !_error_occurred && _index >= RHS._index;
            }

        private:
            // Not noexcept, for the same reason as key_iterator's.
            inline value_iterator(const RegKey *key, int index, int count, std::error_code *ec,
                                  bool query)
                : _key(key), _ec(ec), _query(query), _index(index), _count(count) {
                fetch();
            }

            inline void fetch() const {
                if (_index >= _count || _index < 0)
                    return;
#ifdef STDC_HAS_EXCEPTIONS
                if (!_ec) {
                    _data = _key->valueAt(_index, _query);
                    return;
                }
#endif
                _data = _key->valueAt(_index, *_ec, _query);
                if (_ec->value() != ERROR_SUCCESS) {
                    _error_occurred = true;
                }
            }

            const RegKey *_key;
            mutable std::error_code *_ec;
            bool _query;
            mutable bool _error_occurred = false;
            mutable int _index;
            int _count;
            mutable std::optional<value_type> _data;

            friend class value_enumerator;
        };

        using reverse_value_iterator = reverse_iterator<value_iterator>;

        class value_enumerator {
        public:
#ifdef STDC_HAS_EXCEPTIONS
            inline value_enumerator(const RegKey *key, bool query)
                : _key(key), _ec(nullptr), _count(_key->valueCount()), _query(query) {
            }
#endif
            inline value_enumerator(const RegKey *key, std::error_code &ec, bool query)
                : _key(key), _ec(&ec), _count(_key->valueCount(ec)), _query(query) {
            }
            inline value_iterator begin() const {
                return value_iterator(_key, 0, _count, _ec, _query);
            }
            inline value_iterator end() const {
                return value_iterator(_key, _count, _count, _ec, _query);
            }
            inline reverse_value_iterator rbegin() const {
                return reverse_value_iterator(end());
            }
            inline reverse_value_iterator rend() const {
                return reverse_value_iterator(begin());
            }

        private:
            const RegKey *_key;
            std::error_code *_ec;
            int _count;
            bool _query;
        };

        /// A range over the subkeys, readable with a range-for or through its random access
        /// iterators.
        ///
        /// Each step reads the next name from the registry rather than from a snapshot, so the
        /// range is only worth walking once.
        ///
        /// \warning An error stops the traversal where it stands and the loop simply ends, so a
        ///          partial listing reads exactly like a complete one. Check \a ec after the
        ///          loop, not inside it.
        /// \warning The range borrows this key and, when supplied, \a ec. Both must outlive it.
        ///
        /// \code
        ///   std::error_code ec;
        ///   for (const auto &sub : key.enumKeys(ec)) {
        ///       use(sub.name);
        ///   }
        ///   if (ec.value() != ERROR_SUCCESS) {
        ///       return ec;
        ///   }
        /// \endcode
        ///
        /// \sa enumValues()
#ifdef STDC_HAS_EXCEPTIONS
        inline key_enumerator enumKeys() const & {
            return key_enumerator(this);
        }
        key_enumerator enumKeys() const && = delete;
#endif

        inline key_enumerator enumKeys(std::error_code &ec) const & {
            return key_enumerator(this, ec);
        }
        key_enumerator enumKeys(std::error_code &ec) const && = delete;

        /// The same over the values.
        ///
        /// \param query whether to read each value along with its name, which costs a second
        ///        registry call per entry and is wasted when only the names are wanted
        /// \sa enumKeys(), for the error handling this shares
#ifdef STDC_HAS_EXCEPTIONS
        inline value_enumerator enumValues(bool query = false) const & {
            return value_enumerator(this, query);
        }
        value_enumerator enumValues(bool query = false) const && = delete;
#endif

        inline value_enumerator enumValues(std::error_code &ec, bool query = false) const & {
            return value_enumerator(this, ec, query);
        }
        value_enumerator enumValues(std::error_code &ec, bool query = false) const && = delete;

    protected:
        HKEY _hkey;
        bool _owns;
        mutable DWORD _max_key_name_size = 0;
        mutable DWORD _max_value_name_size = 0;

        STDC_DISABLE_COPY(RegKey);

        friend class key_iterator;
        friend class value_iterator;
    };

    /// @}

    // Everything below is a definition of something declared above, and sits outside the group
    // on purpose. A member defined out of line inside a group block is listed as a function of
    // the group, beside the classes rather than under the one it belongs to.

    inline RegValue::RegValue(const uint8_t *data, int size)
        : RegValue(array_view<uint8_t>(data, size)) {
    }

    inline RegValue::RegValue(uint32_t value) : RegValue(static_cast<int32_t>(value)) {
    }

    inline RegValue::RegValue(uint64_t value) : RegValue(static_cast<int64_t>(value)) {
    }

    inline uint32_t RegValue::toUInt32() const {
        return static_cast<uint32_t>(toInt32());
    }

    inline uint64_t RegValue::toUInt64() const {
        return static_cast<uint64_t>(toInt64());
    }

    inline RegValue RegKey::valueOr(const std::wstring &name, std::error_code &ec,
                                    const RegValue &defaultValue) const noexcept {
        auto result = value(name, ec);
        if (ec.value() == ERROR_FILE_NOT_FOUND) {
            ec.clear();
            return defaultValue;
        }
        return result;
    }

    // The overloads that report a failure by throwing, which is every one below. An inline
    // function that is not a template is compiled in every translation unit that includes it,
    // called or not, so leaving these here without exceptions does not merely make them
    // unusable, it stops the header compiling at all.
#ifdef STDC_HAS_EXCEPTIONS

    inline RegKey RegKey::open(const std::wstring &path, int access) {
        std::error_code ec;
        auto result = open(path, ec, access);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline RegKey RegKey::create(const std::wstring &path, int access, int options,
                                 LPSECURITY_ATTRIBUTES sa, bool *exists) {
        std::error_code ec;
        auto result = create(path, ec, access, options, sa, exists);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline bool RegKey::close() {
        std::error_code ec;
        auto result = close(ec);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline int RegKey::keyCount() const {
        std::error_code ec;
        auto result = keyCount(ec);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline std::optional<RegKey::KeyData> RegKey::keyAt(int index) const {
        std::error_code ec;
        auto result = keyAt(index, ec);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline int RegKey::valueCount() const {
        std::error_code ec;
        auto result = valueCount(ec);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline std::optional<RegKey::ValueData> RegKey::valueAt(int index, bool query) const {
        std::error_code ec;
        auto result = valueAt(index, ec, query);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline bool RegKey::flush() {
        std::error_code ec;
        auto result = flush(ec);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline bool RegKey::save(const std::wstring &filename, LPSECURITY_ATTRIBUTES sa, int flags) {
        std::error_code ec;
        auto result = save(filename, ec, sa, flags);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline bool RegKey::hasKey(const std::wstring &path) const {
        std::error_code ec;
        auto result = hasKey(path, ec);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline bool RegKey::hasValue(const std::wstring &name) const {
        std::error_code ec;
        auto result = hasValue(name, ec);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline RegValue RegKey::value(const std::wstring &name) const {
        std::error_code ec;
        auto result = value(name, ec);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline RegValue RegKey::valueOr(const std::wstring &name, const RegValue &defaultValue) const {
        std::error_code ec;
        auto result = valueOr(name, ec, defaultValue);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline bool RegKey::setValue(const std::wstring &name, const RegValue &value) {
        std::error_code ec;
        auto result = setValue(name, value, ec);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline bool RegKey::removeKey(const std::wstring &path) {
        std::error_code ec;
        auto result = removeKey(path, ec);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline bool RegKey::removeValue(const std::wstring &name) {
        std::error_code ec;
        auto result = removeValue(name, ec);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline bool RegKey::removeAll() {
        std::error_code ec;
        auto result = removeAll(ec);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

    inline bool RegKey::notify(bool watchSubtree, int notifyFilter, HANDLE event, bool async) {
        std::error_code ec;
        auto result = notify(ec, watchSubtree, notifyFilter, event, async);
        if (ec.value() != ERROR_SUCCESS)
            throw std::system_error(ec);
        return result;
    }

#endif

}

#endif // STDCORELIB_REGISTRY_H
