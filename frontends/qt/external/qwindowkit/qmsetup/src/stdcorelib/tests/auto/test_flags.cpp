// SPDX-License-Identifier: MIT

#include <stdcorelib/flags.h>

#include <boost/test/unit_test.hpp>

#include <cstdint>
#include <type_traits>

using namespace stdc;

namespace {

    enum class Permission { None = 0, Read = 0x01, Write = 0x02, Execute = 0x04 };

    STDC_DECLARE_FLAGS(Permissions, Permission)
    STDC_DECLARE_OPERATORS_FOR_FLAGS(Permissions)

    enum class BigPermission : uint64_t { None = 0, A = 1ull << 40, B = 1ull << 41 };

    STDC_DECLARE_FLAGS(BigPermissions, BigPermission)
    STDC_DECLARE_OPERATORS_FOR_FLAGS(BigPermissions)

}

BOOST_AUTO_TEST_SUITE(test_flags)

BOOST_AUTO_TEST_CASE(test_type_and_construct) {
    static_assert(std::is_same_v<decltype(Permission::Read | Permission::Write), Permissions>);
    static_assert(std::is_same_v<decltype(Permission::Read & Permission::Write), Permissions>);

    Permissions perms;
    BOOST_CHECK(!static_cast<bool>(perms));

    perms = Permission::Read | Permission::Write;
    BOOST_CHECK(perms.test_flag(Permission::Read));
    BOOST_CHECK(perms.test_any_flag(Permission::Write));
    BOOST_CHECK(!perms.test_flag(Permission::Execute));

    Permissions from_list{Permission::Read, Permission::Execute};
    BOOST_CHECK(from_list.test_flags(Permission::Read | Permission::Execute));
}

BOOST_AUTO_TEST_CASE(test_set_and_bitops) {
    Permissions perms = Permission::Read;

    perms.set_flag(Permission::Write);
    BOOST_CHECK(perms.test_flags(Permission::Read | Permission::Write));

    perms.set_flag(Permission::Read, false);
    BOOST_CHECK(!perms.test_flag(Permission::Read));
    BOOST_CHECK(perms == Permission::Write);

    perms ^= Permission::Execute;
    BOOST_CHECK(perms.test_any_flags(Permission::Write | Permission::Execute));

    auto and_result = perms & Permission::Write;
    BOOST_CHECK(and_result == Permission::Write);
}

BOOST_AUTO_TEST_CASE(test_from_to_int_and_64bit_enum) {
    auto combined = BigPermission::A | BigPermission::B;
    BOOST_CHECK(combined.test_flag(BigPermission::A));
    BOOST_CHECK(combined.test_flag(BigPermission::B));

    BigPermissions raw = BigPermissions::fromInt((1ull << 41));
    BOOST_CHECK(raw == BigPermission::B);
    BOOST_CHECK_EQUAL(static_cast<uint64_t>(raw.toInt()), (1ull << 41));

    // the storage is wide enough that the high bits are not lost
    static_assert(sizeof(BigPermissions::Int) == sizeof(uint64_t));
    BOOST_CHECK_EQUAL(static_cast<uint64_t>(combined.toInt()), (1ull << 40) | (1ull << 41));

    // round trip through the integer representation
    BOOST_CHECK(BigPermissions::fromInt(combined.toInt()) == combined);
    BOOST_CHECK(Permissions::fromInt(0) == Permissions());
}

BOOST_AUTO_TEST_CASE(test_empty_and_conversion) {
    Permissions none;
    BOOST_CHECK(!static_cast<bool>(none));
    BOOST_CHECK_EQUAL(none.toInt(), 0);
    BOOST_CHECK(none == Permission::None);

    // test_flags against an all-zero mask asks "is this empty?"
    BOOST_CHECK(none.test_flags(Permission::None));
    BOOST_CHECK(none.test_flag(Permission::None));
    BOOST_CHECK(!Permissions(Permission::Read).test_flags(Permission::None));

    // ...while test_any_flags against an empty mask is always false
    BOOST_CHECK(!none.test_any_flag(Permission::None));
    BOOST_CHECK(!Permissions(Permission::Read).test_any_flag(Permission::None));

    Permissions some = Permission::Read;
    BOOST_CHECK(static_cast<bool>(some));
    BOOST_CHECK_EQUAL(static_cast<int>(some), 0x01);
}

BOOST_AUTO_TEST_CASE(test_all_bitops) {
    const Permissions rw = Permission::Read | Permission::Write;

    // binary operators against both an enumerator and another flags value
    BOOST_CHECK((rw | Permission::Execute) ==
                Permissions({Permission::Read, Permission::Write, Permission::Execute}));
    BOOST_CHECK((rw & Permission::Read) == Permission::Read);
    BOOST_CHECK((rw ^ Permission::Read) == Permission::Write);
    BOOST_CHECK((rw & Permissions(Permission::Write)) == Permission::Write);
    BOOST_CHECK((rw ^ rw) == Permissions());

    // the enum-on-the-left forms come from STDC_DECLARE_OPERATORS_FOR_FLAGS
    BOOST_CHECK((Permission::Read | rw) == rw);
    BOOST_CHECK((Permission::Read & rw) == Permission::Read);
    BOOST_CHECK((Permission::Read ^ Permission::Write) == rw);

    // compound assignment, in both the flags and the enum flavour
    {
        Permissions p = rw;
        p &= Permission::Read;
        BOOST_CHECK(p == Permission::Read);

        p |= Permissions(Permission::Execute);
        BOOST_CHECK(p.test_flags(Permission::Read | Permission::Execute));

        p ^= Permissions(Permission::Read);
        BOOST_CHECK(p == Permission::Execute);
    }

    // complement flips every bit, so it round trips through a mask
    {
        Permissions all = {Permission::Read, Permission::Write, Permission::Execute};
        BOOST_CHECK((~rw & all) == Permission::Execute);
        BOOST_CHECK(~~rw == rw);
    }
}

BOOST_AUTO_TEST_CASE(test_comparison) {
    const Permissions rw = Permission::Read | Permission::Write;

    BOOST_CHECK(rw == (Permission::Read | Permission::Write));
    BOOST_CHECK(rw != Permission::Read);

    // enum on either side
    BOOST_CHECK(Permissions(Permission::Read) == Permission::Read);
    BOOST_CHECK(Permission::Read == Permissions(Permission::Read));
    BOOST_CHECK(Permission::Write != Permissions(Permission::Read));
}

BOOST_AUTO_TEST_CASE(test_set_flag) {
    Permissions p;

    // setting a flag that is already set changes nothing
    p.set_flag(Permission::Read);
    p.set_flag(Permission::Read);
    BOOST_CHECK(p == Permission::Read);

    // clearing one that is not set changes nothing either
    p.set_flag(Permission::Write, false);
    BOOST_CHECK(p == Permission::Read);

    p.set_flag(Permission::Write);
    BOOST_CHECK(p.test_flags(Permission::Read | Permission::Write));

    p.set_flag(Permission::Read, false);
    BOOST_CHECK(p == Permission::Write);
    BOOST_CHECK(!p.test_flag(Permission::Read));

    p.set_flag(Permission::Write, false);
    BOOST_CHECK(!static_cast<bool>(p));

    // it returns *this, so calls chain
    Permissions q;
    q.set_flag(Permission::Read).set_flag(Permission::Execute);
    BOOST_CHECK(q.test_flags(Permission::Read | Permission::Execute));
}

// Everything is usable in a constant expression.
BOOST_AUTO_TEST_CASE(test_constexpr) {
    constexpr Permissions rw = Permission::Read | Permission::Write;
    static_assert(rw.test_flag(Permission::Read));
    static_assert(!rw.test_flag(Permission::Execute));
    static_assert(rw.test_any_flag(Permission::Write));
    static_assert(rw.toInt() == 0x03);
    static_assert(Permissions().toInt() == 0);
    static_assert((rw & Permission::Read) == Permission::Read);
    static_assert(Permissions::fromInt(0x03) == rw);
    static_assert(Permissions{Permission::Read, Permission::Execute}.toInt() == 0x05);

    BOOST_CHECK(true); // the checks above are compile time
}

BOOST_AUTO_TEST_SUITE_END()
