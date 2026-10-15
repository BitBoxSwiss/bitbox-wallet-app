// SPDX-License-Identifier: MIT

#include <algorithm>
#include <thread>
#include <type_traits>
#include <utility>

#include <stdcorelib/platform/windows/registry.h>

#include <stdcorelib/scope_guard.h>

#include <boost/test/unit_test.hpp>

using namespace stdc::windows;

namespace {

    static_assert(std::is_same_v<decltype(std::declval<const RegValue &>().toBinary()),
                                 const std::vector<uint8_t> &>);
    static_assert(std::is_same_v<decltype(std::declval<const RegValue &>().toStringList()),
                                 const std::vector<std::wstring> &>);

    template <class T, class = void>
    struct can_enum_keys : std::false_type {};

    template <class T>
    struct can_enum_keys<T, std::void_t<decltype(std::declval<T>().enumKeys())>> : std::true_type {
    };

    template <class T, class = void>
    struct can_enum_keys_with_error : std::false_type {};

    template <class T>
    struct can_enum_keys_with_error<
        T, std::void_t<decltype(std::declval<T>().enumKeys(std::declval<std::error_code &>()))>>
        : std::true_type {};

    template <class T, class = void>
    struct can_enum_values : std::false_type {};

    template <class T>
    struct can_enum_values<T, std::void_t<decltype(std::declval<T>().enumValues())>>
        : std::true_type {};

    template <class T, class = void>
    struct can_enum_values_with_error : std::false_type {};

    template <class T>
    struct can_enum_values_with_error<
        T, std::void_t<decltype(std::declval<T>().enumValues(std::declval<std::error_code &>()))>>
        : std::true_type {};

    static_assert(can_enum_keys<const RegKey &>::value);
    static_assert(!can_enum_keys<RegKey &&>::value);
    static_assert(can_enum_keys_with_error<const RegKey &>::value);
    static_assert(!can_enum_keys_with_error<RegKey &&>::value);
    static_assert(can_enum_values<const RegKey &>::value);
    static_assert(!can_enum_values<RegKey &&>::value);
    static_assert(can_enum_values_with_error<const RegKey &>::value);
    static_assert(!can_enum_values_with_error<RegKey &&>::value);

}

BOOST_AUTO_TEST_SUITE(test_registry)

BOOST_AUTO_TEST_CASE(test_reg_read_write) {
    std::error_code ec;

    std::wstring TEST_KEY = L"SOFTWARE\\test_registry";

    RegKey hkcuKey(RegKey::RK_CurrentUser);
    RegKey testKey =
        hkcuKey.create(TEST_KEY, ec, RegKey::DA_Read | RegKey::DA_Write, RegKey::CO_Volatile);
    BOOST_REQUIRE_EQUAL(ec.value(), ERROR_SUCCESS);
    BOOST_REQUIRE(testKey.isValid());

    std::pair<std::wstring, RegValue> TEST_STRING =
        std::make_pair(L"test_string", RegValue(L"test_value"));
    std::pair<std::wstring, RegValue> TEST_STRING_NULL =
        std::make_pair(L"test_string_null", RegValue(RegValue::String));
    std::pair<std::wstring, RegValue> TEST_STRING_LIST = //
        std::make_pair(L"test_string_list",
                       RegValue({L"test_value1", L"test_value2", L"test_value3"}));
    std::pair<std::wstring, RegValue> TEST_STRING_LIST_NULL =
        std::make_pair(L"test_string_list_null", RegValue(RegValue::StringList));
    std::pair<std::wstring, RegValue> TEST_DWORD =
        std::make_pair(L"test_dword", RegValue(static_cast<uint32_t>(1234)));
    std::pair<std::wstring, RegValue> TEST_QWORD =
        std::make_pair(L"test_qword", RegValue(static_cast<uint64_t>(123456789)));
    std::pair<std::wstring, RegValue> TEST_BINARY =
        std::make_pair(L"test_binary", RegValue(std::vector<uint8_t>{0x01, 0x02, 0x03, 0x04}));
    std::pair<std::wstring, RegValue> TEST_BINARY_NULL =
        std::make_pair(L"test_binary_null", RegValue(RegValue::Binary));
    std::pair<std::wstring, RegValue> TEST_NOT_EXIST = //
        std::make_pair(L"test_not_exist", RegValue());
    std::pair<std::wstring, RegValue> TEST_DEFAULT =
        std::make_pair(L"", RegValue(L"default_value"));

    // The guard runs from a destructor, so it uses the overloads that report through ec. The
    // throwing ones would end the process rather than the test.
    auto deleteGuard = stdc::make_scope_guard([&]() {
        std::error_code ignored;
        testKey.close(ignored);
        hkcuKey.removeKey(TEST_KEY, ignored);
    });

    // Set values
    BOOST_CHECK(testKey.setValue(TEST_STRING.first, TEST_STRING.second, ec));
    BOOST_CHECK(testKey.setValue(TEST_STRING_NULL.first, TEST_STRING_NULL.second, ec));
    BOOST_CHECK(testKey.setValue(TEST_STRING_LIST.first, TEST_STRING_LIST.second, ec));
    BOOST_CHECK(testKey.setValue(TEST_STRING_LIST_NULL.first, TEST_STRING_LIST_NULL.second, ec));
    BOOST_CHECK(testKey.setValue(TEST_DWORD.first, TEST_DWORD.second, ec));
    BOOST_CHECK(testKey.setValue(TEST_QWORD.first, TEST_QWORD.second, ec));
    BOOST_CHECK(testKey.setValue(TEST_BINARY.first, TEST_BINARY.second, ec));
    BOOST_CHECK(testKey.setValue(TEST_BINARY_NULL.first, TEST_BINARY_NULL.second, ec));
    BOOST_CHECK(testKey.setValue(TEST_DEFAULT.first, TEST_DEFAULT.second, ec));

    // String values stored through the wrapper include the terminators required by the
    // registry formats. Also install a deliberately unterminated external value to verify that
    // the reader respects the byte count instead of scanning past the allocation.
    HKEY nativeKey = nullptr;
    BOOST_REQUIRE_EQUAL(
        ::RegOpenKeyExW(HKEY_CURRENT_USER, TEST_KEY.c_str(), 0, KEY_READ | KEY_WRITE, &nativeKey),
        ERROR_SUCCESS);
    auto nativeKeyGuard = stdc::make_scope_guard([&]() { ::RegCloseKey(nativeKey); });
    DWORD storedSize = 0;
    BOOST_REQUIRE_EQUAL(::RegQueryValueExW(nativeKey, TEST_STRING.first.c_str(), nullptr, nullptr,
                                           nullptr, &storedSize),
                        ERROR_SUCCESS);
    BOOST_CHECK_EQUAL(storedSize, (TEST_STRING.second.toString().size() + 1) * sizeof(wchar_t));

    const wchar_t unterminated[] = L"external";
    BOOST_REQUIRE_EQUAL(::RegSetValueExW(nativeKey, L"unterminated", 0, REG_SZ,
                                         reinterpret_cast<const BYTE *>(unterminated),
                                         DWORD(sizeof(unterminated) - sizeof(wchar_t))),
                        ERROR_SUCCESS);
    BOOST_CHECK(testKey.value(L"unterminated", ec).toString() == L"external");

    // Get values
    {
        RegValue val = testKey.value(TEST_STRING.first, ec);
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);
        BOOST_CHECK(val == TEST_STRING.second);
    }
    {
        RegValue val = testKey.value(TEST_STRING_NULL.first, ec);
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);
        BOOST_CHECK(val == TEST_STRING_NULL.second);
    }
    {
        RegValue val = testKey.value(TEST_STRING_LIST.first, ec);
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);
        BOOST_CHECK(val == TEST_STRING_LIST.second);
    }
    {
        RegValue val = testKey.value(TEST_STRING_LIST_NULL.first, ec);
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);
        BOOST_CHECK(val == TEST_STRING_LIST_NULL.second);
    }
    {
        RegValue val = testKey.value(TEST_DWORD.first, ec);
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);
        BOOST_CHECK(val == TEST_DWORD.second);
    }
    {
        RegValue val = testKey.value(TEST_QWORD.first, ec);
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);
        BOOST_CHECK(val == TEST_QWORD.second);
    }
    {
        RegValue val = testKey.value(TEST_BINARY.first, ec);
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);
        BOOST_CHECK(val == TEST_BINARY.second);
    }
    {
        RegValue val = testKey.value(TEST_BINARY_NULL.first, ec);
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);
        BOOST_CHECK(val == TEST_BINARY_NULL.second);
    }
    {
        RegValue val = testKey.value(TEST_NOT_EXIST.first, ec);
        BOOST_CHECK(ec.value() == ERROR_FILE_NOT_FOUND);
        BOOST_CHECK(!val.isValid());

        // valueOr turns that one error into the caller's own answer and clears it
        auto fallback = testKey.valueOr(TEST_NOT_EXIST.first, ec, RegValue(L"fallback"));
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);
        BOOST_CHECK(fallback.toString() == L"fallback");

        // and leaves a value that is there alone
        auto present = testKey.valueOr(TEST_STRING.first, ec, RegValue(L"fallback"));
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);
        BOOST_CHECK(present == TEST_STRING.second);
    }

    // hasValue answers without reading the data, and hasKey the same for subkeys
    {
        BOOST_CHECK(testKey.hasValue(TEST_STRING.first, ec));
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);
        BOOST_CHECK(!testKey.hasValue(TEST_NOT_EXIST.first, ec));
        BOOST_CHECK(ec.value() == ERROR_SUCCESS); // absent is an answer, not a failure

        BOOST_CHECK(!testKey.hasKey(L"no_such_subkey", ec));
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);

        RegKey sub =
            testKey.create(L"subkey", ec, RegKey::DA_Read | RegKey::DA_Write, RegKey::CO_Volatile);
        BOOST_REQUIRE(sub.isValid());
        BOOST_CHECK(testKey.hasKey(L"subkey", ec));
        BOOST_CHECK_EQUAL(testKey.keyCount(ec), 1);
        BOOST_CHECK(sub.close(ec));
        BOOST_CHECK(testKey.removeKey(L"subkey", ec));
        BOOST_CHECK(!testKey.hasKey(L"subkey", ec));
    }

    // create says whether the key was already there
    {
        bool existed = true;
        RegKey fresh = testKey.create(L"created_once", ec, RegKey::DA_Read | RegKey::DA_Write,
                                      RegKey::CO_Volatile, nullptr, &existed);
        BOOST_REQUIRE(fresh.isValid());
        BOOST_CHECK(!existed);

        RegKey again = testKey.create(L"created_once", ec, RegKey::DA_Read | RegKey::DA_Write,
                                      RegKey::CO_Volatile, nullptr, &existed);
        BOOST_CHECK(existed);
        BOOST_CHECK(again.close(ec));
        BOOST_CHECK(fresh.close(ec));
        BOOST_CHECK(testKey.removeKey(L"created_once", ec));
    }

    // valueCount counts what was written, and the unnamed default value is one of them
    BOOST_CHECK_EQUAL(testKey.valueCount(ec), 10);
    {
        RegValue val = testKey.value(TEST_DEFAULT.first, ec);
        BOOST_CHECK(ec.value() == ERROR_SUCCESS);
        BOOST_CHECK(val == TEST_DEFAULT.second);
    }

    // Remove values
    BOOST_CHECK(testKey.removeValue(TEST_STRING.first, ec));
    BOOST_CHECK(testKey.removeValue(TEST_STRING_NULL.first, ec));
    BOOST_CHECK(testKey.removeValue(TEST_STRING_LIST.first, ec));
    BOOST_CHECK(testKey.removeValue(TEST_STRING_LIST_NULL.first, ec));
    BOOST_CHECK(testKey.removeValue(TEST_DWORD.first, ec));
    BOOST_CHECK(testKey.removeValue(TEST_QWORD.first, ec));
    BOOST_CHECK(testKey.removeValue(TEST_BINARY.first, ec));
    BOOST_CHECK(testKey.removeValue(TEST_BINARY_NULL.first, ec));
    BOOST_CHECK(testKey.removeValue(TEST_DEFAULT.first, ec));
    BOOST_CHECK_EQUAL(ec.value(), ERROR_SUCCESS);

    // removing one that is not there says so rather than reporting success
    BOOST_CHECK(!testKey.removeValue(TEST_NOT_EXIST.first, ec));
    BOOST_CHECK_EQUAL(ec.value(), ERROR_FILE_NOT_FOUND);
}

// RegValue models the registry types worth carrying, not all of them. A value of any other type
// has to report that it could not be read, because a caller that only checks ec would otherwise
// be told the read worked and handed nothing.
BOOST_AUTO_TEST_CASE(test_value_of_an_unsupported_type) {
    std::error_code ec;
    const std::wstring path = L"SOFTWARE\\test_registry_exotic";

    RegKey hkcuKey(RegKey::RK_CurrentUser);
    RegKey key = hkcuKey.create(path, ec, RegKey::DA_Read | RegKey::DA_Write, RegKey::CO_Volatile);
    BOOST_REQUIRE(key.isValid());
    auto guard = stdc::make_scope_guard([&] {
        std::error_code ignored;
        key.close(ignored);
        hkcuKey.removeKey(path, ignored);
    });

    BOOST_REQUIRE(key.setValue(L"ordinary", RegValue(L"text"), ec));

    // REG_RESOURCE_LIST, which the reader has no case for. The keys under Enum are full of them,
    // so this is not a contrived value.
    const BYTE blob[8] = {1, 2, 3, 4, 5, 6, 7, 8};
    BOOST_REQUIRE_EQUAL(
        ::RegSetValueExW(key.handle(), L"exotic", 0, REG_RESOURCE_LIST, blob, sizeof(blob)),
        ERROR_SUCCESS);

    auto val = key.value(L"exotic", ec);
    BOOST_CHECK(!val.isValid());
    BOOST_CHECK_EQUAL(ec.value(), ERROR_UNSUPPORTED_TYPE);

    // and the enumeration stops on it rather than walking into a value that was never read
    int seen = 0;
    for (const auto &entry : key.enumValues(ec, true)) {
        BOOST_CHECK(entry.value.isValid());
        ++seen;
    }
    BOOST_CHECK_EQUAL(ec.value(), ERROR_UNSUPPORTED_TYPE);
    BOOST_CHECK(seen < 2);

    // reading only the names never touches the data, so it walks the whole key
    seen = 0;
    for (const auto &entry : key.enumValues(ec)) {
        BOOST_CHECK(!entry.name.empty());
        ++seen;
    }
    BOOST_CHECK_EQUAL(ec.value(), ERROR_SUCCESS);
    BOOST_CHECK_EQUAL(seen, 2);
}

// Every operation comes in a throwing form and a form that reports through an error_code. They
// have to agree about what went wrong.
BOOST_AUTO_TEST_CASE(test_throwing_overloads) {
    RegKey hkcuKey(RegKey::RK_CurrentUser);

    std::error_code ec;
    RegKey missing = hkcuKey.open(L"SOFTWARE\\stdcorelib_no_such_key", ec);
    BOOST_CHECK(!missing.isValid());
    BOOST_CHECK_EQUAL(ec.value(), ERROR_FILE_NOT_FOUND);

    BOOST_CHECK_THROW(hkcuKey.open(L"SOFTWARE\\stdcorelib_no_such_key"), std::system_error);

    try {
        hkcuKey.open(L"SOFTWARE\\stdcorelib_no_such_key");
        BOOST_ERROR("open should have thrown");
    } catch (const std::system_error &e) {
        BOOST_CHECK_EQUAL(e.code().value(), ERROR_FILE_NOT_FOUND);
    }
}

// valueOr is the one pair where the throwing overload is not simply the ec one with a throw on
// the end: a missing value is the answer rather than a failure, so that overload has to come
// back with the default and not raise. Only the ec form was covered.
BOOST_AUTO_TEST_CASE(test_value_or_without_an_error_code) {
    std::error_code ec;
    RegKey hkcuKey(RegKey::RK_CurrentUser);
    RegKey testKey = hkcuKey.create(L"SOFTWARE\\test_registry_value_or", ec,
                                    RegKey::DA_Read | RegKey::DA_Write, RegKey::CO_Volatile);
    BOOST_REQUIRE(testKey.isValid());
    auto guard = stdc::make_scope_guard([&] {
        std::error_code ignored;
        hkcuKey.removeKey(L"SOFTWARE\\test_registry_value_or", ignored);
    });

    BOOST_REQUIRE(testKey.setValue(L"present", RegValue(L"here"), ec));

    // A value that is there comes back whatever the default says.
    BOOST_CHECK(testKey.valueOr(L"present", RegValue(L"fallback")).toString() == L"here");

    // One that is not is the default rather than an exception.
    BOOST_CHECK_NO_THROW(testKey.valueOr(L"absent", RegValue(L"fallback")));
    BOOST_CHECK(testKey.valueOr(L"absent", RegValue(L"fallback")).toString() == L"fallback");

    // And with no default given at all, which is RegValue::Invalid. That argument had never been
    // written down anywhere, so nothing had checked it names a type rather than the number -1:
    // RegValue has a constructor taking Type and another taking int32_t.
    RegValue absent = testKey.valueOr(L"absent");
    BOOST_CHECK(!absent.isValid());
    BOOST_CHECK_EQUAL(absent.type(), RegValue::Invalid);

    RegValue absentWithCode = testKey.valueOr(L"absent", ec);
    BOOST_CHECK_EQUAL(ec.value(), ERROR_SUCCESS);
    BOOST_CHECK(!absentWithCode.isValid());

    // A real failure still throws. A key whose handle is gone answers nothing at all, and that
    // is not the missing value case valueOr swallows.
    RegKey closed = hkcuKey.open(L"SOFTWARE\\test_registry_value_or", ec, RegKey::DA_Read);
    BOOST_REQUIRE(closed.isValid());
    BOOST_REQUIRE(closed.close(ec));
    BOOST_CHECK_THROW(closed.valueOr(L"present", RegValue(L"fallback")), std::system_error);
}

// Every enumeration above hands the iterators an ec, so they take keyAt(index, ec) and never the
// overload that throws. Same for removeAll. These three had no caller at all.
BOOST_AUTO_TEST_CASE(test_enumerating_without_an_error_code) {
    std::error_code ec;
    RegKey hkcuKey(RegKey::RK_CurrentUser);
    RegKey testKey = hkcuKey.create(L"SOFTWARE\\test_registry_no_ec", ec,
                                    RegKey::DA_Read | RegKey::DA_Write, RegKey::CO_Volatile);
    BOOST_REQUIRE(testKey.isValid());
    auto guard = stdc::make_scope_guard([&] {
        std::error_code ignored;
        hkcuKey.removeKey(L"SOFTWARE\\test_registry_no_ec", ignored);
    });

    // Volatile like its parent: Windows refuses a key that would outlive the one above it.
    BOOST_REQUIRE(
        testKey.create(L"child", ec, RegKey::DA_Read | RegKey::DA_Write, RegKey::CO_Volatile)
            .isValid());
    BOOST_REQUIRE(testKey.setValue(L"a_value", RegValue(L"a"), ec));

    // Indexed reads, which is what the iterators call when given no ec.
    auto firstKey = testKey.keyAt(0);
    BOOST_REQUIRE(firstKey.has_value());
    BOOST_CHECK(firstKey->name == L"child");

    auto firstValue = testKey.valueAt(0);
    BOOST_REQUIRE(firstValue.has_value());
    BOOST_CHECK(firstValue->name == L"a_value");

    // Past the end the two forms part company. The one taking an ec answers with an empty
    // optional and ERROR_NO_MORE_ITEMS, and the one without treats that as a failure like any
    // other and throws, so its optional is in practice never empty.
    BOOST_CHECK(!testKey.keyAt(99, ec).has_value());
    BOOST_CHECK_EQUAL(ec.value(), ERROR_NO_MORE_ITEMS);
    BOOST_CHECK(!testKey.valueAt(99, ec).has_value());
    BOOST_CHECK_EQUAL(ec.value(), ERROR_NO_MORE_ITEMS);

    BOOST_CHECK_THROW(testKey.keyAt(99), std::system_error);
    BOOST_CHECK_THROW(testKey.valueAt(99), std::system_error);

    // And the enumerators built without an ec walk the same way as the ones with.
    int keys = 0;
    for (const auto &entry : testKey.enumKeys()) {
        BOOST_CHECK(entry.name == L"child");
        ++keys;
    }
    BOOST_CHECK_EQUAL(keys, 1);

    int values = 0;
    for (const auto &entry : testKey.enumValues()) {
        BOOST_CHECK(entry.name == L"a_value");
        ++values;
    }
    BOOST_CHECK_EQUAL(values, 1);

    // removeAll empties the key and leaves the key itself.
    BOOST_CHECK(testKey.removeAll());
    BOOST_CHECK_EQUAL(testKey.keyCount(), 0);
    BOOST_CHECK_EQUAL(testKey.valueCount(), 0);
    BOOST_CHECK(testKey.isValid());
}

BOOST_AUTO_TEST_CASE(test_regkey_ownership) {
    std::error_code ec;
    RegKey hkcuKey(RegKey::RK_CurrentUser);

    // A predefined root is not ours to close, and closing it must not take the handle out from
    // under everything else in the process.
    BOOST_CHECK(hkcuKey.isValid());

    RegKey key = hkcuKey.create(L"SOFTWARE\\test_registry_ownership", ec,
                                RegKey::DA_Read | RegKey::DA_Write, RegKey::CO_Volatile);
    BOOST_REQUIRE(key.isValid());
    auto guard = stdc::make_scope_guard([&] {
        std::error_code ignored;
        hkcuKey.removeKey(L"SOFTWARE\\test_registry_ownership", ignored);
    });

    // moving leaves the source with nothing to close
    HKEY raw = key.handle();
    RegKey moved = std::move(key);
    BOOST_CHECK(moved.handle() == raw);
    BOOST_CHECK(!key.isValid());

    // Move assignment takes the handle over without closing either one on the way, so a target
    // that already held a key does not lose it to a double close. What becomes of the source is
    // not asked here: a moved-from object is only good for being destroyed, and it is, at the
    // end of this scope, which is what closes the key the target used to hold.
    RegKey assigned = hkcuKey.create(L"SOFTWARE\\test_registry_ownership\\assigned", ec,
                                     RegKey::DA_Read | RegKey::DA_Write, RegKey::CO_Volatile);
    BOOST_REQUIRE(assigned.isValid());
    assigned = std::move(moved);
    BOOST_CHECK(assigned.handle() == raw);

    BOOST_CHECK(assigned.removeKey(L"assigned", ec));
    BOOST_CHECK(!ec);

    // take() hands the handle over, so the wrapper stops owning it
    HKEY taken = assigned.take();
    BOOST_CHECK(taken == raw);
    BOOST_CHECK(!assigned.isValid());

    // wrapping without owning leaves it open for the caller to close
    {
        RegKey borrowed(taken, false);
        BOOST_CHECK(borrowed.isValid());
        BOOST_CHECK_EQUAL(borrowed.valueCount(ec), 0);
    }
    BOOST_CHECK_EQUAL(::RegCloseKey(taken), ERROR_SUCCESS);
}

BOOST_AUTO_TEST_CASE(test_regvalue) {

    std::wstring TEST_STRING_VALUE = L"test_string_value";
    std::vector<std::wstring> TEST_STRING_LIST_VALUE = {
        L"test_string_list_value1",
        L"test_string_list_value2",
        L"test_string_list_value3",
    };
    uint32_t TEST_DWORD_VALUE = 1234;
    uint64_t TEST_QWORD_VALUE = 123456789;
    std::vector<uint8_t> TEST_BINARY_VALUE = {0x01, 0x02, 0x03, 0x04};

    {
        RegValue val1(TEST_STRING_VALUE);
        RegValue val2(TEST_STRING_LIST_VALUE);
        RegValue val3(TEST_DWORD_VALUE);
        RegValue val4(TEST_QWORD_VALUE);
        RegValue val5(TEST_BINARY_VALUE);

        BOOST_CHECK(val1.type() == RegValue::String);
        BOOST_CHECK(val2.type() == RegValue::StringList);
        BOOST_CHECK(val3.type() == RegValue::Int32);
        BOOST_CHECK(val4.type() == RegValue::Int64);
        BOOST_CHECK(val5.type() == RegValue::Binary);

        BOOST_CHECK(val1.toString() == TEST_STRING_VALUE);
        BOOST_CHECK(val2.toStringList() == TEST_STRING_LIST_VALUE);
        BOOST_CHECK(val3.toUInt32() == TEST_DWORD_VALUE);
        BOOST_CHECK(val4.toUInt64() == TEST_QWORD_VALUE);
        BOOST_CHECK(val5.toBinary() == TEST_BINARY_VALUE);
    }

    const wchar_t TEST_STRING_LIST_LITERAL_1[] =
        L"test_string_list_value1\0test_string_list_value2\0test_string_list_value3";
    const wchar_t TEST_STRING_LIST_LITERAL_2[] =
        L"test_string_list_value1\0test_string_list_value2\0test_string_list_value3\0";
    const wchar_t TEST_STRING_LIST_LITERAL_3[] =
        L"test_string_list_value1\0test_string_list_value2\0test_string_list_value3\0\0";

    // A REG_MULTI_SZ arrives with none, one or two trailing terminators depending on who wrote
    // it, and all three mean the same list.
    {
        const auto units = [](const wchar_t *, size_t bytes) {
            return int(bytes / sizeof(wchar_t)) - 1; // less the terminator the compiler added
        };

        RegValue val1(TEST_STRING_LIST_LITERAL_1,
                      units(TEST_STRING_LIST_LITERAL_1, sizeof(TEST_STRING_LIST_LITERAL_1)),
                      RegValue::StringList);
        RegValue val2(TEST_STRING_LIST_LITERAL_2,
                      units(TEST_STRING_LIST_LITERAL_2, sizeof(TEST_STRING_LIST_LITERAL_2)),
                      RegValue::StringList);
        RegValue val3(TEST_STRING_LIST_LITERAL_3,
                      units(TEST_STRING_LIST_LITERAL_3, sizeof(TEST_STRING_LIST_LITERAL_3)),
                      RegValue::StringList);

        BOOST_CHECK(val1.type() == RegValue::StringList);
        BOOST_CHECK(val2.type() == RegValue::StringList);
        BOOST_CHECK(val3.type() == RegValue::StringList);

        BOOST_CHECK(val1.toStringList() == TEST_STRING_LIST_VALUE);
        BOOST_CHECK(val2.toStringList() == TEST_STRING_LIST_VALUE);
        BOOST_CHECK(val3.toStringList() == TEST_STRING_LIST_VALUE);

        // and they compare equal to each other, not just to the same vector
        BOOST_CHECK(val1 == val2);
        BOOST_CHECK(val2 == val3);
    }

    // The readers do not convert. Asking a value for a type it does not hold gives a default and
    // says nothing went wrong, which is why the isXxx() checks exist.
    {
        RegValue str(TEST_STRING_VALUE);
        BOOST_CHECK(str.isString());
        BOOST_CHECK(!str.isInt32());
        BOOST_CHECK_EQUAL(str.toInt32(), 0);
        BOOST_CHECK_EQUAL(str.toInt64(), 0);
        BOOST_CHECK(str.toBinary().empty());

        RegValue num(TEST_DWORD_VALUE);
        BOOST_CHECK(num.isInt32());
        BOOST_CHECK(num.toString().empty());
        BOOST_CHECK(num.toStringList().empty());

        // and a value of a different type is never equal to one of this type
        BOOST_CHECK(str != num);
    }

    // A default constructed value is a valid None, while the Invalid one is what a failed read
    // reports.
    {
        BOOST_CHECK(RegValue().isNone());
        BOOST_CHECK(RegValue().isValid());
        BOOST_CHECK(!RegValue(RegValue::Invalid).isValid());
    }

    // Copies and moves carry the data, which for the string and list types sits behind a shared
    // pointer rather than in the object.
    {
        RegValue original(TEST_STRING_LIST_VALUE);
        RegValue copy = original;
        BOOST_CHECK(copy == original);
        BOOST_CHECK(copy.toStringList() == TEST_STRING_LIST_VALUE);

        RegValue moved = std::move(copy);
        BOOST_CHECK(moved.toStringList() == TEST_STRING_LIST_VALUE);
        BOOST_CHECK(moved == original);
    }

    // Copies share their immutable representation. Concurrent const reads must not race to
    // populate storage behind that shared pointer, whichever form the value was built from.
    {
        RegValue fromRaw(TEST_STRING_LIST_LITERAL_3,
                         int(sizeof(TEST_STRING_LIST_LITERAL_3) / sizeof(wchar_t)) - 1,
                         RegValue::StringList);
        RegValue rawCopy = fromRaw;
        std::vector<std::wstring> rawResult1;
        std::vector<std::wstring> rawResult2;
        std::thread rawReader1([&] { rawResult1 = fromRaw.toStringList(); });
        std::thread rawReader2([&] { rawResult2 = rawCopy.toStringList(); });
        rawReader1.join();
        rawReader2.join();
        BOOST_CHECK(rawResult1 == TEST_STRING_LIST_VALUE);
        BOOST_CHECK(rawResult2 == TEST_STRING_LIST_VALUE);

        RegValue fromList(TEST_STRING_LIST_VALUE);
        RegValue listCopy = fromList;
        std::wstring listResult1;
        std::wstring listResult2;
        std::thread listReader1([&] { listResult1 = fromList.toString(); });
        std::thread listReader2([&] { listResult2 = listCopy.toString(); });
        listReader1.join();
        listReader2.join();
        BOOST_CHECK(RegValue(listResult1, RegValue::StringList).toStringList() ==
                    TEST_STRING_LIST_VALUE);
        BOOST_CHECK(RegValue(listResult2, RegValue::StringList).toStringList() ==
                    TEST_STRING_LIST_VALUE);
    }

    // Copying an owning result from a temporary completes before that RegValue is destroyed.
    std::wstring fromTemporary = RegValue(std::wstring(128, L'x')).toString();
    BOOST_CHECK(fromTemporary == std::wstring(128, L'x'));
    std::vector<uint8_t> binaryFromTemporary =
        RegValue(std::vector<uint8_t>{1, 2, 3, 4}).toBinary();
    BOOST_CHECK(binaryFromTemporary == std::vector<uint8_t>({1, 2, 3, 4}));
}

BOOST_AUTO_TEST_CASE(test_regkey) {
    std::error_code ec;

    RegKey hklmKey(RegKey::RK_LocalMachine);
    RegKey systemKey = hklmKey.open(L"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion", ec);
    BOOST_REQUIRE_EQUAL(ec.value(), ERROR_SUCCESS);
    BOOST_REQUIRE(systemKey.isValid());

    {
        // test collect
        std::vector<std::wstring> subkeys;
        for (const auto &subkey : systemKey.enumKeys(ec)) {
            subkeys.push_back(subkey.name);
        }
        BOOST_CHECK_EQUAL(ec.value(), ERROR_SUCCESS);

        // the range walked as far as the count said it would, which a stopped traversal would
        // not have done and which the loop alone cannot tell you
        BOOST_CHECK_EQUAL(int(subkeys.size()), systemKey.keyCount(ec));

        // "Windows" should be one of the subkeys
        BOOST_CHECK(std::find(subkeys.begin(), subkeys.end(), L"Windows") != subkeys.end());

        // test enumerate
        {
            std::vector<std::wstring> reversedSubkeys;
            auto keys = systemKey.enumKeys(ec);
            for (auto it = keys.rbegin(); it != keys.rend(); ++it) {
                reversedSubkeys.push_back(it->name);
            }
            BOOST_CHECK_EQUAL(ec.value(), ERROR_SUCCESS);
            std::reverse(reversedSubkeys.begin(), reversedSubkeys.end());
            BOOST_CHECK(reversedSubkeys == subkeys);
        }
    }

    {
        // test collect
        std::vector<std::wstring> values;
        for (const auto &val : systemKey.enumValues(ec)) {
            values.push_back(val.name);
            BOOST_CHECK(val.value.isNone()); // not read unless asked for
        }
        BOOST_CHECK_EQUAL(ec.value(), ERROR_SUCCESS);
        BOOST_CHECK_EQUAL(int(values.size()), systemKey.valueCount(ec));

        // "ProductName" should be one of the values
        BOOST_CHECK(std::find(values.begin(), values.end(), L"ProductName") != values.end());

        // test enumerate
        {
            std::vector<std::wstring> reversedValues;
            auto vals = systemKey.enumValues(ec);
            for (auto it = vals.rbegin(); it != vals.rend(); ++it) {
                reversedValues.push_back(it->name);
            }
            BOOST_CHECK_EQUAL(ec.value(), ERROR_SUCCESS);
            std::reverse(reversedValues.begin(), reversedValues.end());
            BOOST_CHECK(reversedValues == values);
        }

        // asking for the data as well is the other half of that parameter
        for (const auto &val : systemKey.enumValues(ec, true)) {
            if (val.name == L"ProductName") {
                BOOST_CHECK(val.value.isString());
                BOOST_CHECK(!val.value.toString().empty());
            }
        }
        BOOST_CHECK_EQUAL(ec.value(), ERROR_SUCCESS);
    }
}

BOOST_AUTO_TEST_SUITE_END()
