// SPDX-License-Identifier: MIT

#include "registry.h"

#include <tuple>
#include <variant>
#include <cassert>
#include <cstdint>
#include <cstring>

#ifdef _MSC_VER
#  include <intrin.h>
#endif

#include "winapi.h"
#include "str.h"
#include "vlarray.h"

namespace stdc::windows {

    // Which way round this machine is. GCC and Clang say so directly, and MSVC says only which
    // processor it is building for, which is how Qt works it out as well. Anything else is an
    // error rather than a guess, since guessing wrong is read silently as wrong numbers.
#if defined(__BYTE_ORDER__) && defined(__ORDER_LITTLE_ENDIAN__)
    constexpr bool little_endian_host = __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__;
#elif defined(_M_IX86) || defined(_M_X64) || defined(_M_ARM) || defined(_M_ARM64) ||               \
    defined(_M_ARM64EC)
    constexpr bool little_endian_host = true;
#else
#  error "cannot tell which way round this machine is"
#endif

    template <class T>
    static T byteswap(T value) {
        static_assert(sizeof(T) == 2 || sizeof(T) == 4 || sizeof(T) == 8, "no swap for this size");
#ifdef _MSC_VER
        if constexpr (sizeof(T) == 2)
            return (T) _byteswap_ushort((unsigned short) value);
        else if constexpr (sizeof(T) == 4)
            return (T) _byteswap_ulong((unsigned long) value);
        else
            return (T) _byteswap_uint64((unsigned long long) value);
#else
        if constexpr (sizeof(T) == 2)
            return (T) __builtin_bswap16((uint16_t) value);
        else if constexpr (sizeof(T) == 4)
            return (T) __builtin_bswap32((uint32_t) value);
        else
            return (T) __builtin_bswap64((uint64_t) value);
#endif
    }

    template <class T>
    static T qFromLittleEndian(const void *data) {
        T value;
        std::memcpy(&value, data, sizeof(value));
        if constexpr (little_endian_host) {
            return value;
        } else {
            return byteswap(value);
        }
    }

    template <class T>
    static T qFromBigEndian(const void *data) {
        T value;
        std::memcpy(&value, data, sizeof(value));
        if constexpr (little_endian_host) {
            return byteswap(value);
        } else {
            return value;
        }
    }

    static inline std::error_code make_status_error_code(LSTATUS status) {
        return std::error_code(status, stdc::windows_utf8_category());
    }

    static inline LSTATUS getRegSubKeyCountAndMaxLen(HKEY hkey, DWORD *dwSubKeys,
                                                     DWORD *dwLongestSubKeyLen) {
        return ::RegQueryInfoKeyW(hkey,               // Key handle
                                  nullptr,            // Buffer for registry ked class name
                                  nullptr,            // Size of class string
                                  nullptr,            // Reserved
                                  dwSubKeys,          // Number of key subkeys
                                  dwLongestSubKeyLen, // Longest subkey size
                                  nullptr,            // Longest class string
                                  nullptr,            // number of values for this key
                                  nullptr,            // Longest value name
                                  nullptr,            // Longest value data
                                  nullptr,            // Security descriptor
                                  nullptr             // Last key write time
        );
    }

    static inline LSTATUS getRegValueCountAndMaxLen(HKEY hkey, DWORD *dwValues,
                                                    DWORD *dwLongestValueNameLen) {
        return ::RegQueryInfoKeyW(hkey,                  // Key handle
                                  nullptr,               // Buffer for registry ked class name
                                  nullptr,               // Size of class string
                                  nullptr,               // Reserved
                                  nullptr,               // Number of key subkeys
                                  nullptr,               // Longest subkey size
                                  nullptr,               // Longest class string
                                  dwValues,              // number of values for this key
                                  dwLongestValueNameLen, // Longest value name
                                  nullptr,               // Longest value data
                                  nullptr,               // Security descriptor
                                  nullptr                // Last key write time
        );
    }

    struct RegValue::Comp {
        std::variant<std::monostate, std::vector<uint8_t>, std::wstring> s;
        std::optional<std::vector<std::wstring>> sl;

        void initializeStringList() {
            assert(s.index() == 2);

            std::vector<std::wstring> stringList;
            if (wchar_t *multiStr = std::get<2>(s).data()) {
                for (const wchar_t *entry = multiStr; *entry;) {
                    std::wstring entryStr(entry);
                    auto entryLen = entryStr.size();
                    stringList.emplace_back(std::move(entryStr));
                    entry += entryLen + 1;
                }
            }
            sl = std::move(stringList);
        }

        void initializeRawStringList() {
            assert(sl);

            std::wstring rawString;
            for (const auto &item : std::as_const(sl.value())) {
                rawString += item;
                rawString.push_back(L'\0');
            }
            rawString.push_back(L'\0');
            s = std::move(rawString);
        }
    };

    RegValue::RegValue(Type type) : t(type) {
        switch (type) {
            case None:
            case Invalid:
                break;
            case Binary:
                comp = std::make_shared<Comp>();
                comp->s = std::vector<uint8_t>();
                break;
            case Int32:
                d.dw = 0;
                break;
            case Int64:
                d.qw = 0;
                break;
            case String:
            case ExpandString:
            case Link:
                comp = std::make_shared<Comp>();
                comp->s = std::wstring();
                break;
            case StringList:
                comp = std::make_shared<Comp>();
                comp->sl = std::vector<std::wstring>();
                comp->initializeRawStringList();
                break;
            default:
                d.p = nullptr;
                break;
        }
    }

    RegValue::RegValue(const array_view<uint8_t> &data)
        : t(Binary), comp(std::make_shared<Comp>()) {
        comp->s = data.vec();
    }

    RegValue::RegValue(std::vector<uint8_t> &&data) : t(Binary), comp(std::make_shared<Comp>()) {
        comp->s = std::move(data);
    }

    RegValue::RegValue(int32_t value) : t(Int32) {
        d.dw = value;
    }

    RegValue::RegValue(int64_t value) : t(Int64) {
        d.qw = value;
    }

    static std::wstring rawStringToStringList(const wchar_t *value, int size) {
        if (size < 0) {
            if (const wchar_t *stringList = value) {
                const wchar_t *entry;
                for (entry = stringList; *entry;) {
                    std::wstring entryStr(entry);
                    auto entryLen = entryStr.size();
                    entry += entryLen + 1;
                }
                return std::wstring(value, entry - value + 1);
            }
            return std::wstring(1, L'\0');
        }

        std::wstring tmp(value, size);
        if (tmp.empty()) {
            tmp.push_back(L'\0');
            return tmp;
        }
        if (tmp.back() != L'\0') {
            tmp += std::wstring(2, L'\0');
            return tmp;
        }
        if (tmp.size() > 1 && tmp[tmp.size() - 2] != L'\0') {
            tmp.push_back(L'\0');
            return tmp;
        }
        return tmp;
    }

    RegValue::RegValue(const std::wstring &value, Type type)
        : RegValue(value.data(), value.size(), type) {
    }

    RegValue::RegValue(std::wstring &&value, Type type) : t(type), comp(std::make_shared<Comp>()) {
        switch (type) {
            case String:
            case ExpandString:
            case Link: {
                comp->s = std::move(value);
                break;
            }
            case StringList: {
                comp->s = rawStringToStringList(value.data(), value.size());
                comp->initializeStringList();
                break;
            }
            default: {
                t = Invalid;
                break;
            }
        }
    }

    RegValue::RegValue(const wchar_t *value, int size, Type type) : t(type) {
        switch (type) {
            case String:
            case ExpandString:
            case Link: {
                comp = std::make_shared<Comp>();
                comp->s = size < 0 ? std::wstring(value) : std::wstring(value, size);
                break;
            }
            case StringList:
                comp = std::make_shared<Comp>();
                comp->s = rawStringToStringList(value, size);
                comp->initializeStringList();
                break;
            default: {
                t = Invalid;
                break;
            }
        }
    }

    RegValue::RegValue(const array_view<std::wstring> &value)
        : t(StringList), comp(std::make_shared<Comp>()) {
        comp->sl = value.vec();
        comp->initializeRawStringList();
    }

    RegValue::RegValue(std::vector<std::wstring> &&value)
        : t(StringList), comp(std::make_shared<Comp>()) {
        comp->sl = std::move(value);
        comp->initializeRawStringList();
    }

    RegValue::RegValue(const void *data, int type) : t(type) {
        d.p = data;
    }

    RegValue::~RegValue() = default;

    RegValue::RegValue(const RegValue &RHS) = default;

    RegValue::RegValue(RegValue &&RHS) noexcept = default;

    RegValue &RegValue::operator=(const RegValue &RHS) = default;

    RegValue &RegValue::operator=(RegValue &&RHS) noexcept = default;

    const std::vector<uint8_t> &RegValue::toBinary() const {
        static const std::vector<uint8_t> empty;

        if (!isBinary()) {
            return empty;
        }
        assert(comp && comp->s.index() == 1);
        return std::get<1>(comp->s);
    }

    int32_t RegValue::toInt32() const {
        if (!isInt32()) {
            return 0;
        }
        return d.dw;
    }

    int64_t RegValue::toInt64() const {
        if (!isInt64()) {
            return 0;
        }
        return d.qw;
    }

    const std::wstring &RegValue::toString() const {
        static const std::wstring empty;

        if (isStringList()) {
            assert(comp && comp->s.index() == 2 && comp->sl);
            return std::get<2>(comp->s);
        }
        if (comp && comp->s.index() == 2) {
            return std::get<2>(comp->s);
        }
        return empty;
    }

    const std::vector<std::wstring> &RegValue::toStringList() const {
        static const std::vector<std::wstring> empty;

        if (!isStringList()) {
            return empty;
        }
        assert(comp && comp->s.index() == 2 && comp->sl);
        return comp->sl.value();
    }

    std::wstring RegValue::toExpandString() const {
        if (!isExpandString()) {
            return {};
        }
        assert(comp && comp->s.index() == 2);
        return winapi::kernel32::ExpandEnvironmentStringsW(std::get<2>(comp->s).c_str(), nullptr);
    }

    std::wstring RegValue::toLink() const {
        if (!isLink()) {
            return {};
        }
        assert(comp && comp->s.index() == 2);
        return toString();
    }

    bool RegValue::operator==(const RegValue &RHS) const {
        if (t != RHS.t) {
            return false;
        }
        switch (t) {
            case None:
            case Invalid:
                return true;
            case Binary:
                return toBinary() == RHS.toBinary();
            case Int32:
                return toInt32() == RHS.toInt32();
            case Int64:
                return toInt64() == RHS.toInt64();
            case String:
            case ExpandString:
            case Link:
                return toString() == RHS.toString();
            case StringList:
                return toStringList() == RHS.toStringList();
            default:
                break;
        }
        return false;
    }

    RegKey::~RegKey() {
        if (_hkey && _owns) {
            std::ignore = ::RegCloseKey(_hkey);
        }
    }

    static inline HKEY getReservedKey(RegKey::ReservedKey key) {
        switch (key) {
            case RegKey::RK_ClassesRoot:
                return HKEY_CLASSES_ROOT;
            case RegKey::RK_CurrentUser:
                return HKEY_CURRENT_USER;
            case RegKey::RK_LocalMachine:
                return HKEY_LOCAL_MACHINE;
            case RegKey::RK_Users:
                return HKEY_USERS;
            case RegKey::RK_CurrentConfig:
                return HKEY_CURRENT_CONFIG;
            default:
                break;
        }
        return nullptr;
    }

    RegKey::RegKey(ReservedKey key) noexcept : _hkey(getReservedKey(key)), _owns(false) {
    }

    RegKey::RegKey(RegKey &&RHS) noexcept
        : _hkey(RHS._hkey), _owns(RHS._owns), _max_key_name_size(RHS._max_key_name_size),
          _max_value_name_size(RHS._max_value_name_size) {
        RHS._hkey = nullptr;
        RHS._owns = false;
    }

    RegKey &RegKey::operator=(RegKey &&RHS) noexcept {
        std::swap(_hkey, RHS._hkey);
        std::swap(_owns, RHS._owns);
        std::swap(_max_key_name_size, RHS._max_key_name_size);
        std::swap(_max_value_name_size, RHS._max_value_name_size);
        return *this;
    }

    RegKey RegKey::open(const std::wstring &path, std::error_code &ec, int access) noexcept {
        ec.clear();

        HKEY hkey = nullptr;
        LSTATUS status =
            ::RegOpenKeyExW(_hkey, path.c_str(), 0, static_cast<REGSAM>(access), &hkey);
        if (status != ERROR_SUCCESS) {
            ec = make_status_error_code(status);
            return {};
        }
        return RegKey(hkey, true);
    }

    RegKey RegKey::create(const std::wstring &path, std::error_code &ec, int access, int options,
                          LPSECURITY_ATTRIBUTES sa, bool *exists) noexcept {
        ec.clear();

        HKEY hkey = nullptr;
        DWORD disposition = 0;
        LSTATUS status =
            ::RegCreateKeyExW(_hkey, path.c_str(), 0, nullptr, static_cast<DWORD>(options),
                              static_cast<REGSAM>(access), sa, &hkey, &disposition);
        if (status != ERROR_SUCCESS) {
            ec = make_status_error_code(status);
            return {};
        }
        if (exists) {
            *exists = disposition == REG_OPENED_EXISTING_KEY;
        }
        return RegKey(hkey, true);
    }

    bool RegKey::close(std::error_code &ec) noexcept {
        ec.clear();

        LSTATUS status = ::RegCloseKey(_hkey);
        if (status != ERROR_SUCCESS) {
            ec = make_status_error_code(status);
            return false;
        }
        _hkey = nullptr;
        return true;
    }

    int RegKey::keyCount(std::error_code &ec) const noexcept {
        ec.clear();

        // update max key name size by the way
        DWORD count;
        LSTATUS status = getRegSubKeyCountAndMaxLen(_hkey, &count, &_max_key_name_size);
        if (status != ERROR_SUCCESS) {
            ec = make_status_error_code(status);
            return 0;
        }
        return count;
    }

    std::optional<RegKey::KeyData> RegKey::keyAt(int index, std::error_code &ec) const noexcept {
        ec.clear();

        auto &maxsize = _max_key_name_size; // subkey names, so not the value name cache
        KeyData data;

        LSTATUS status;
        std::wstring buffer;
        while (true) {
            buffer.resize(maxsize + 1);

            DWORD bufferSize = maxsize + 1;
            status = ::RegEnumKeyExW(_hkey, index, buffer.data(), &bufferSize, nullptr, nullptr,
                                     nullptr, &data.lastWriteTime);
            if (status == ERROR_MORE_DATA) {
                status = getRegSubKeyCountAndMaxLen(_hkey, nullptr, &maxsize);
                if (status != ERROR_SUCCESS) {
                    ec = make_status_error_code(status);
                    return {};
                }
                continue;
            }
            if (status != ERROR_SUCCESS) {
                ec = make_status_error_code(status);
                return {};
            }
            buffer.resize(bufferSize);
            break;
        };

        // assign name
        data.name = std::move(buffer);
        return data;
    }

    int RegKey::valueCount(std::error_code &ec) const noexcept {
        ec.clear();

        // update max value name size by the way
        DWORD count;
        LSTATUS status = getRegValueCountAndMaxLen(_hkey, &count, &_max_value_name_size);
        if (status != ERROR_SUCCESS) {
            ec = make_status_error_code(status);
            return 0;
        }
        return count;
    }

    std::optional<RegKey::ValueData> RegKey::valueAt(int index, std::error_code &ec,
                                                     bool query) const noexcept {
        ec.clear();

        auto &maxsize = _max_value_name_size;
        RegKey::ValueData data;

        LSTATUS status;
        std::wstring buffer;
        while (true) {
            buffer.resize(maxsize + 1);

            DWORD bufferSize = maxsize + 1;
            status = ::RegEnumValueW(_hkey, index, buffer.data(), &bufferSize, nullptr, nullptr,
                                     nullptr, nullptr);
            if (status == ERROR_MORE_DATA) {
                status = getRegValueCountAndMaxLen(_hkey, nullptr, &maxsize);
                if (status != ERROR_SUCCESS) {
                    ec = make_status_error_code(status);
                    return {};
                }
                continue;
            }
            if (status != ERROR_SUCCESS) {
                ec = make_status_error_code(status);
                return {};
            }
            buffer.resize(bufferSize);
            break;
        };

        // assign name
        data.name = std::move(buffer);

        // assign value
        if (query) {
            // The overload taking ec, not the one that throws. This function is noexcept, so an
            // unreadable value would end the process rather than be reported.
            RegValue val = value(data.name, ec);
            if (!val.isValid()) {
                return {};
            }
            data.value = std::move(val);
        }
        return data;
    }

    bool RegKey::flush(std::error_code &ec) noexcept {
        ec.clear();

        LSTATUS status = ::RegFlushKey(_hkey);
        if (status != ERROR_SUCCESS) {
            ec = make_status_error_code(status);
            return false;
        }
        return true;
    }

    bool RegKey::save(const std::wstring &filename, std::error_code &ec, LPSECURITY_ATTRIBUTES sa,
                      int flags) noexcept {
        ec.clear();

        LSTATUS status = ::RegSaveKeyExW(_hkey, filename.c_str(), sa, flags);
        if (status != ERROR_SUCCESS) {
            ec = make_status_error_code(status);
            return false;
        }
        return true;
    }

    bool RegKey::hasKey(const std::wstring &path, std::error_code &ec) const noexcept {
        ec.clear();

        bool hasKey = false;
        HKEY hkey = nullptr;
        LSTATUS status = ::RegOpenKeyExW(_hkey, path.c_str(), 0, KEY_READ, &hkey);
        if (status == ERROR_SUCCESS) {
            assert(hkey);
            std::ignore = ::RegCloseKey(hkey);
            hasKey = true;
        } else if (status != ERROR_FILE_NOT_FOUND) {
            ec = make_status_error_code(status);
            return false;
        }
        return hasKey;
    }

    bool RegKey::hasValue(const std::wstring &name, std::error_code &ec) const noexcept {
        ec.clear();

        bool hasValue = false;
        LSTATUS status =
            ::RegQueryValueExW(_hkey, name.c_str(), nullptr, nullptr, nullptr, nullptr);
        if (status == ERROR_SUCCESS) {
            hasValue = true;
        } else if (status != ERROR_FILE_NOT_FOUND) {
            ec = make_status_error_code(status);
            return false;
        }
        return hasValue;
    }

    // https://github.com/qt/qtbase/blob/v6.8.0/src/corelib/kernel/qwinregistry.cpp#L39
    RegValue RegKey::value(const std::wstring &name, std::error_code &ec) const noexcept {
        ec.clear();

        // NOTE: Empty value name is allowed in Windows registry, it means the default
        // or unnamed value of a key, you can read/write/delete such value normally.

        // Use nullptr when we need to access the default value.
        const auto subKeyC =
            name.empty() ? nullptr : reinterpret_cast<const wchar_t *>(name.data());

        // Get the size and type of the value.
        DWORD dataType = REG_NONE;
        DWORD dataSize = 0;
        LONG ret = ::RegQueryValueExW(_hkey, subKeyC, nullptr, &dataType, nullptr, &dataSize);
        if (ret != ERROR_SUCCESS) {
            ec = make_status_error_code(ret);
            return RegValue(RegValue::Invalid);
        }

        // Get the value.
        // Registry strings are not guaranteed to be terminated. Keep two zero wchar_t values
        // beyond the returned bytes so malformed external values remain safe to parse.
        vlarray<wchar_t, 256> data((dataSize + sizeof(wchar_t) - 1) / sizeof(wchar_t) + 2);
        std::fill(data.begin(), data.end(), 0u);

        ret = ::RegQueryValueExW(_hkey, subKeyC, nullptr, nullptr,
                                 reinterpret_cast<BYTE *>(data.data()), &dataSize);
        if (ret != ERROR_SUCCESS) {
            ec = make_status_error_code(ret);
            return RegValue(RegValue::Invalid);
        }

        switch (dataType) {
            case REG_SZ: {
                if (dataSize > 0) {
                    size_t size = dataSize / sizeof(wchar_t);
                    const auto *str = data.data();
                    if (size && str[size - 1] == L'\0')
                        --size;
                    return RegValue(str, int(size));
                }
                return RegValue(RegValue::Type::String);
            }
            case REG_EXPAND_SZ: {
                if (dataSize > 0) {
                    size_t size = dataSize / sizeof(wchar_t);
                    const auto *str = data.data();
                    if (size && str[size - 1] == L'\0')
                        --size;
                    return RegValue(str, int(size), RegValue::ExpandString);
                }
                return RegValue(RegValue::Type::ExpandString);
            }
            case REG_LINK: {
                if (dataSize > 0) {
                    size_t size = dataSize / sizeof(wchar_t);
                    const auto *str = data.data();
                    if (size && str[size - 1] == L'\0')
                        --size;
                    return RegValue(str, int(size), RegValue::Link);
                }
                return RegValue(RegValue::Type::Link);
            }

            case REG_MULTI_SZ: {
                if (dataSize > 0) {
                    return RegValue(data.data(), dataSize / sizeof(wchar_t), RegValue::StringList);
                }
                return RegValue(RegValue::StringList);
            }

            case REG_NONE: {
                return RegValue(RegValue::None);
            }
            case REG_BINARY: {
                if (dataSize > 0) {
                    return RegValue(reinterpret_cast<const uint8_t *>(data.data()), dataSize);
                }
                return RegValue(RegValue::Type::Binary);
            }

            case REG_DWORD: // Same as REG_DWORD_LITTLE_ENDIAN
                if (dataSize < sizeof(uint32_t))
                    break;
                return qFromLittleEndian<uint32_t>(data.data());

            case REG_DWORD_BIG_ENDIAN:
                if (dataSize < sizeof(uint32_t))
                    break;
                return qFromBigEndian<uint32_t>(data.data());

            case REG_QWORD: // Same as REG_QWORD_LITTLE_ENDIAN
                if (dataSize < sizeof(uint64_t))
                    break;
                return qFromLittleEndian<uint64_t>(data.data());

            default:
                break;
        }

        // The read itself worked, so leaving ec clear here would say the value came back when it
        // did not. Registry types this does not model are common: the keys under Enum are full
        // of REG_RESOURCE_LIST.
        ec = make_status_error_code(ERROR_UNSUPPORTED_TYPE);
        return RegValue(RegValue::Invalid);
    }

    bool RegKey::setValue(const std::wstring &name, const RegValue &value,
                          std::error_code &ec) noexcept {
        if (!value.isValid()) {
            return removeValue(name, ec);
        }

        ec.clear();

        const auto &writeString = [&](DWORD type) {
            const std::wstring &data = value.toString();
            std::wstring terminated(data);
            if (type == REG_MULTI_SZ) {
                if (terminated.empty() || terminated.back() != L'\0')
                    terminated.push_back(L'\0');
                if (terminated.size() < 2 || terminated[terminated.size() - 2] != L'\0')
                    terminated.push_back(L'\0');
            } else {
                terminated.push_back(L'\0');
            }
            return ::RegSetValueExW(_hkey, name.c_str(), 0, type,
                                    reinterpret_cast<const BYTE *>(terminated.data()),
                                    DWORD(terminated.size() * sizeof(wchar_t)));
        };

        LSTATUS ret = ERROR_SUCCESS;
        switch (value.type()) {
            case RegValue::Invalid:
                break;
            case RegValue::None: {
                ret = ::RegSetValueExW(_hkey, name.c_str(), 0, REG_NONE, nullptr, 0);
                break;
            }
            case RegValue::Binary: {
                auto data = value.toBinary();
                ret = ::RegSetValueExW(_hkey, name.c_str(), 0, REG_BINARY,
                                       data.empty() ? nullptr : data.data(), data.size());
                break;
            }
            case RegValue::Int32: {
                auto num = value.toInt32();
                ret = ::RegSetValueExW(_hkey, name.c_str(), 0, REG_DWORD,
                                       reinterpret_cast<const BYTE *>(&num), sizeof(num));
                break;
            }
            case RegValue::Int64: {
                auto num = value.toInt64();
                ret = ::RegSetValueExW(_hkey, name.c_str(), 0, REG_QWORD,
                                       reinterpret_cast<const BYTE *>(&num), sizeof(num));
                break;
            }
            case RegValue::String: {
                ret = writeString(REG_SZ);
                break;
            }
            case RegValue::StringList: {
                ret = writeString(REG_MULTI_SZ);
                break;
            }
            case RegValue::ExpandString: {
                ret = writeString(REG_EXPAND_SZ);
                break;
            }
            case RegValue::Link: {
                ret = writeString(REG_LINK);
                break;
            }
        }
        if (ret != ERROR_SUCCESS) {
            ec = make_status_error_code(ret);
            return false;
        }
        return true;
    }

    bool RegKey::removeKey(const std::wstring &path, std::error_code &ec) noexcept {
        ec.clear();

        LSTATUS status = ::RegDeleteTreeW(_hkey, path.c_str());
        if (status != ERROR_SUCCESS) {
            ec = make_status_error_code(status);
            return false;
        }
        return true;
    }

    bool RegKey::removeValue(const std::wstring &name, std::error_code &ec) noexcept {
        ec.clear();

        LSTATUS status = ::RegDeleteValueW(_hkey, name.c_str());
        if (status != ERROR_SUCCESS) {
            ec = make_status_error_code(status);
            return false;
        }
        return true;
    }

    bool RegKey::removeAll(std::error_code &ec) noexcept {
        ec.clear();

        LSTATUS status = ::RegDeleteTreeW(_hkey, nullptr);
        if (status != ERROR_SUCCESS) {
            ec = make_status_error_code(status);
            return false;
        }
        return true;
    }

    bool RegKey::notify(std::error_code &ec, bool watchSubtree, int notifyFilter, HANDLE event,
                        bool async) noexcept {
        ec.clear();

        LSTATUS status = ::RegNotifyChangeKeyValue(_hkey, watchSubtree, notifyFilter, event, async);
        if (status != ERROR_SUCCESS) {
            ec = make_status_error_code(status);
            return false;
        }
        return true;
    }

}
