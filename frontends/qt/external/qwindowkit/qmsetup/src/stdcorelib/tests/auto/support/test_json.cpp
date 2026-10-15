// SPDX-License-Identifier: MIT

#include <cmath>
#include <type_traits>

#include <stdcorelib/support/json.h>

#include <boost/test/unit_test.hpp>

namespace json = stdc::json;
namespace cbor = stdc::cbor;

BOOST_AUTO_TEST_SUITE(test_json)

static_assert(std::is_same_v<json::Object::key_compare, std::less<>>);

BOOST_AUTO_TEST_CASE(test_Value_Types) {
    BOOST_CHECK(json::Value().type() == json::Type::Null);
    BOOST_CHECK(json::Value().isNull());

    BOOST_CHECK(json::Value(true).type() == json::Type::Bool);
    BOOST_CHECK(json::Value(1.5).type() == json::Type::Double);
    BOOST_CHECK(json::Value(std::string("s")).type() == json::Type::String);
    BOOST_CHECK(json::Value("s").type() == json::Type::String);
    BOOST_CHECK(json::Value(json::Array{}).type() == json::Type::Array);
    BOOST_CHECK(json::Value(json::Object{}).type() == json::Type::Object);

    // An integer is one type whichever way it was written, signed or not.
    {
        json::Value i(-1);
        BOOST_CHECK(i.type() == json::Type::Int);
        BOOST_CHECK(i.isInt());

        json::Value u(uint32_t(1));
        BOOST_CHECK(u.type() == json::Type::Int);
        BOOST_CHECK(u.isInt());

        // Except above the range int64_t has, where there is nothing left to be exact with.
        json::Value big(UINT64_MAX);
        BOOST_CHECK(big.type() == json::Type::Double);
    }
    // isNumber() spans both numeric types, and nothing else.
    {
        BOOST_CHECK(json::Value(1).isNumber());
        BOOST_CHECK(json::Value(uint32_t(1)).isNumber());
        BOOST_CHECK(json::Value(1.5).isNumber());
        BOOST_CHECK(!json::Value("1").isNumber());
        BOOST_CHECK(!json::Value(true).isNumber());
        BOOST_CHECK(!json::Value().isNumber());
    }
    // A counted string may contain an embedded null.
    {
        json::Value v("ab\0cd", 5);
        BOOST_CHECK(v.toString().size() == 5);
        BOOST_CHECK(v.toString() == std::string("ab\0cd", 5));
    }
    // Binary is its own type and is not a string.
    {
        const uint8_t raw[] = {0x00, 0x01, 0xFE, 0xFF};
        json::Value v(raw, 4);
        BOOST_CHECK(v.type() == json::Type::Binary);
        BOOST_CHECK(!v.isString());
        BOOST_CHECK(v.toBinary().size() == 4);
        BOOST_CHECK(v.toBinary().size() == 4);
        BOOST_CHECK(v.toBinary()[3] == 0xFF);

        // A vector of bytes is taken as it stands rather than through a view, so nothing is
        // copied when the caller already has one.
        std::vector<uint8_t> owned(raw, raw + 4);
        json::Value w(std::move(owned));
        BOOST_CHECK(w.type() == json::Type::Binary);
        BOOST_CHECK(w == v);
    }
    // A container built up first and then wrapped is copied rather than taken over, which is a
    // separate constructor from the one every case above reaches with a temporary.
    {
        json::Array array{json::Value(1), json::Value(2)};
        json::Object object{
            {"a", json::Value(1)}
        };
        json::Value wrapped_array(array);
        json::Value wrapped_object(object);

        array.clear();
        object.clear();
        BOOST_CHECK(wrapped_array.toArray().size() == 2);
        BOOST_CHECK(wrapped_array.toArray()[1].toInt() == 2);
        BOOST_CHECK(wrapped_object.toObject().size() == 1);
        BOOST_CHECK(wrapped_object["a"].toInt() == 1);
    }
}

// A key that is not there reads as null, the same as a key that is there and null.
//
// \note There is no separate undefined state. Telling the two apart is what the object itself is
//       for, since \c toObject hands back the map.
BOOST_AUTO_TEST_CASE(test_Value_MissingKeyIsNull) {
    json::Value obj = json::Value::fromJson(R"({"present": null})", false);
    BOOST_CHECK(obj["missing"].isNull());
    BOOST_CHECK(obj["present"].isNull());
    BOOST_CHECK(obj["missing"] == obj["present"]);

    const json::Object &map = obj.toObject();
    BOOST_CHECK(map.find("present") != map.end());
    BOOST_CHECK(map.find("missing") == map.end());
}

BOOST_AUTO_TEST_CASE(test_Value_Conversions) {
    // Each numeric conversion accepts both numeric types.
    {
        BOOST_CHECK(json::Value(42).toInt() == 42);
        BOOST_CHECK(json::Value(uint32_t(42)).toInt() == 42);
        BOOST_CHECK(json::Value(42.9).toInt() == 42); // truncated, not rounded
        BOOST_CHECK(json::Value(-42).toInt() == -42);

        BOOST_CHECK(json::Value(1.5).toDouble() == 1.5);
        BOOST_CHECK(json::Value(3).toDouble() == 3.0);
    }
    // A mismatched type yields the default rather than throwing.
    {
        json::Value s("text");
        BOOST_CHECK(s.toBool() == false);
        BOOST_CHECK(s.toBool(true) == true);
        BOOST_CHECK(s.toInt() == 0);
        BOOST_CHECK(s.toInt(7) == 7);
        BOOST_CHECK(s.toDouble(1.5) == 1.5);
        BOOST_CHECK(s.toArray().empty());
        BOOST_CHECK(s.toObject().empty());
        BOOST_CHECK(s.toBinary().empty());

        json::Value n;
        BOOST_CHECK(n.toString() == "");
        BOOST_CHECK(n.toString("fallback") == "fallback");
        BOOST_CHECK(n.toString("fallback") == "fallback");
    }
    // A bool is not a number and a number is not a bool.
    {
        BOOST_CHECK(json::Value(true).toInt(-1) == -1);
        BOOST_CHECK(json::Value(1).toBool(false) == false);
    }
    // The defaulted overloads hand back the caller's own object.
    {
        json::Array arrayFallback{json::Value(1)};
        json::Object objectFallback{
            {"k", json::Value(1)}
        };
        json::Value s("text");
        BOOST_CHECK(s.toArray(arrayFallback).size() == 1);
        BOOST_CHECK(s.toObject(objectFallback).size() == 1);
    }
    // Rvalue defaults are returned by value so a temporary cannot leave a dangling reference.
    // Their storage is moved rather than copied when the value has the wrong type.
    {
        std::string stringFallback(128, 's');
        const char *stringData = stringFallback.data();

        std::vector<uint8_t> binaryFallback;
        binaryFallback.reserve(8);
        binaryFallback.push_back(6);
        const uint8_t *binaryData = binaryFallback.data();

        json::Array arrayFallback;
        arrayFallback.reserve(8);
        arrayFallback.emplace_back(7);
        const json::Value *arrayData = arrayFallback.data();

        // clang-format off
        json::Object objectFallback{{"fallback", json::Value(8)}};
        // clang-format on
        const json::Value *objectValue = &objectFallback.begin()->second;

        json::Value s("text");
        std::string string = json::Value().toString(std::move(stringFallback));
        std::vector<uint8_t> binary = s.toBinary(std::move(binaryFallback));
        json::Array array = s.toArray(std::move(arrayFallback));
        json::Object object = s.toObject(std::move(objectFallback));
        BOOST_CHECK(string.data() == stringData);
        BOOST_CHECK(binary.data() == binaryData);
        BOOST_CHECK(array.data() == arrayData);
        BOOST_CHECK(&object.begin()->second == objectValue);
        BOOST_CHECK(array[0].toInt() == 7);
        BOOST_CHECK(binary[0] == 6);
        BOOST_CHECK(object["fallback"].toInt() == 8);

        auto actualArray =
            json::Value(json::Array{json::Value(1)}).toArray(json::Array{json::Value(9)});
        BOOST_CHECK(actualArray[0].toInt() == 1);
        // clang-format off
        BOOST_CHECK(json::Value(json::Object{{"actual", json::Value(2)}})
                        .toObject(json::Object{{"fallback", json::Value(9)}})
                        .at("actual")
                        .toInt() == 2);
        // clang-format on
    }
}

BOOST_AUTO_TEST_CASE(test_Value_AsReadsTheStorageItself) {
    // Where the type matches the payload comes back, and where it does not null does. The cross
    // product is the part worth writing: every accessor has to turn down every other type, which
    // asking each one about its own type would never show.
    {
        const json::Value b(true);
        const json::Value i(int64_t(7));
        const json::Value d(1.5);
        const json::Value s(std::string("x"));
        const json::Value bin(std::vector<uint8_t>{1, 2});
        const json::Value arr(json::Array{json::Value(1)});
        const json::Value obj(json::Object{
            {"k", json::Value(1)}
        });
        const json::Value null;

        BOOST_REQUIRE(b.asBool());
        BOOST_CHECK(*b.asBool());
        BOOST_REQUIRE(i.asInt());
        BOOST_CHECK(*i.asInt() == 7);
        BOOST_REQUIRE(d.asDouble());
        BOOST_CHECK(*d.asDouble() == 1.5);
        BOOST_REQUIRE(s.asString());
        BOOST_CHECK(*s.asString() == "x");
        BOOST_REQUIRE(bin.asBinary());
        BOOST_CHECK(bin.asBinary()->size() == 2);
        BOOST_REQUIRE(arr.asArray());
        BOOST_CHECK(arr.asArray()->size() == 1);
        BOOST_REQUIRE(obj.asObject());
        BOOST_CHECK(obj.asObject()->size() == 1);

        const json::Value *every[] = {&b, &i, &d, &s, &bin, &arr, &obj, &null};
        for (const auto *v : every) {
            BOOST_CHECK((v->asBool() != nullptr) == v->isBool());
            BOOST_CHECK((v->asInt() != nullptr) == v->isInt());
            BOOST_CHECK((v->asDouble() != nullptr) == v->isDouble());
            BOOST_CHECK((v->asString() != nullptr) == v->isString());
            BOOST_CHECK((v->asBinary() != nullptr) == (v->type() == json::Type::Binary));
            BOOST_CHECK((v->asArray() != nullptr) == v->isArray());
            BOOST_CHECK((v->asObject() != nullptr) == v->isObject());
        }
    }
    // as does not convert where to does, which is the whole reason there are two families.
    {
        const json::Value i(int64_t(7));
        BOOST_CHECK(i.toDouble() == 7.0);
        BOOST_CHECK(i.asDouble() == nullptr);

        const json::Value d(2.5);
        BOOST_CHECK(d.toInt() == 2);
        BOOST_CHECK(d.asInt() == nullptr);
    }
    // A value that is not there and one that happens to equal the default read the same through
    // to and differently through as, which is the other reason.
    {
        const json::Value missing;
        const json::Value minusOne(int64_t(-1));
        BOOST_CHECK(missing.toInt(-1) == minusOne.toInt(-1));
        BOOST_CHECK(missing.asInt() == nullptr);
        BOOST_REQUIRE(minusOne.asInt());
        BOOST_CHECK(*minusOne.asInt() == -1);
    }
    // The non-const forms write through, which is the only way to change a document once it is
    // built, and none of them changes what the value says it is.
    {
        json::Value v(json::Object{
            {"n", json::Value(1)}
        });
        BOOST_REQUIRE(v.asObject());
        v.asObject()->emplace("added", json::Value(std::string("x")));
        (*v.asObject())["n"] = json::Value(int64_t(2));
        BOOST_CHECK(v.toObject().size() == 2);
        BOOST_CHECK(v["n"].toInt() == 2);
        BOOST_CHECK(v["added"].toString() == "x");
        BOOST_CHECK(v.type() == json::Type::Object);

        json::Value a(json::Array{});
        a.asArray()->push_back(json::Value(1));
        BOOST_CHECK(a.toArray().size() == 1);
        BOOST_CHECK(a.type() == json::Type::Array);

        json::Value s(std::string("ab"));
        s.asString()->push_back('c');
        BOOST_CHECK(s.toString() == "abc");
        BOOST_CHECK(s.type() == json::Type::String);

        json::Value bin(std::vector<uint8_t>{1});
        bin.asBinary()->push_back(2);
        BOOST_CHECK(bin.toBinary().size() == 2);

        json::Value flag(true);
        *flag.asBool() = false;
        BOOST_CHECK(!flag.toBool());

        json::Value num(int64_t(1));
        *num.asInt() = 5;
        BOOST_CHECK(num.toInt() == 5);

        json::Value real(1.5);
        *real.asDouble() = 2.5;
        BOOST_CHECK(real.toDouble() == 2.5);
    }
    // What is written through one handle is there through the next, so nothing is being handed
    // a copy.
    {
        json::Value v(json::Array{});
        v.asArray()->push_back(json::Value(1));
        BOOST_CHECK(v.asArray()->size() == 1);
        BOOST_CHECK(v.asArray()->data() == v.toArray().data());
    }
    // A const value hands out a const pointer and a mutable one a writable pointer, so a caller
    // cannot reach a writable handle through a const reference.
    {
        static_assert(std::is_same_v<decltype(std::declval<const json::Value &>().asObject()),
                                     const json::Object *>);
        static_assert(
            std::is_same_v<decltype(std::declval<json::Value &>().asObject()), json::Object *>);
        static_assert(std::is_same_v<decltype(std::declval<const json::Value &>().asString()),
                                     const std::string *>);
        static_assert(
            std::is_same_v<decltype(std::declval<json::Value &>().asString()), std::string *>);
        static_assert(
            std::is_same_v<decltype(std::declval<const json::Value &>().asInt()), const int64_t *>);
        static_assert(std::is_same_v<decltype(std::declval<json::Value &>().asInt()), int64_t *>);
    }
}

BOOST_AUTO_TEST_CASE(test_Value_ReadersWithNoDefaultShareOneEmptyObject) {
    // The forms taking no default answer with a shared empty object rather than with a temporary,
    // so what comes back outlives the expression it was read in. Two values of the wrong type get
    // the same one, which is what says it is shared rather than made on the spot.
    const json::Value a(int64_t(1));
    const json::Value b(true);

    BOOST_CHECK(a.toString().empty());
    BOOST_CHECK(a.toBinary().empty());
    BOOST_CHECK(a.toArray().empty());
    BOOST_CHECK(a.toObject().empty());

    BOOST_CHECK(&a.toString() == &b.toString());
    BOOST_CHECK(&a.toBinary() == &b.toBinary());
    BOOST_CHECK(&a.toArray() == &b.toArray());
    BOOST_CHECK(&a.toObject() == &b.toObject());

    // A subscript that finds nothing answers with the one shared null, on either spelling.
    BOOST_CHECK(&a["missing"] == &b["missing"]);
    BOOST_CHECK(&a[size_t(0)] == &b["missing"]);
    BOOST_CHECK(a["missing"].isNull());
}

BOOST_AUTO_TEST_CASE(test_Value_Subscript) {
    json::Value v = json::Value::fromJson(R"({"a": 1, "nested": {"b": [10, 20]}})", false);
    BOOST_REQUIRE(v.isObject());

    BOOST_CHECK(v["a"].toInt() == 1);
    BOOST_CHECK(v["nested"]["b"][0].toInt() == 10);
    BOOST_CHECK(v["nested"]["b"][1].toInt() == 20);

    // Every way of missing the target yields a null value instead of throwing, so chains like the
    // one above never need a check at each step.
    BOOST_CHECK(v["absent"].isNull());
    BOOST_CHECK(v["nested"]["b"][2].isNull());   // index past the end
    BOOST_CHECK(v["a"]["b"].isNull());           // subscripting a number by key
    BOOST_CHECK(v["a"][size_t(0)].isNull());     // subscripting a number by index
    BOOST_CHECK(v["absent"]["deeper"].isNull()); // chaining off a missing key

    const std::string storage = "_nested_";
    BOOST_CHECK(v[std::string_view(storage.data() + 1, 6)]["b"][1].toInt() == 20);
}

BOOST_AUTO_TEST_CASE(test_Value_Equality) {
    BOOST_CHECK(json::Value(1) == json::Value(1));
    BOOST_CHECK(json::Value(1) != json::Value(2));
    BOOST_CHECK(json::Value("a") != json::Value(1));
    BOOST_CHECK(json::Value() == json::Value());
    BOOST_CHECK(json::Value(1) != json::Value("1"));

    // Containers compare by content; an object ignores insertion order because it is a std::map.
    BOOST_CHECK(json::Value::fromJson(R"({"a":1,"b":2})", false) ==
                json::Value::fromJson(R"({"b":2,"a":1})", false));
    BOOST_CHECK(json::Value::fromJson("[1,2]", false) != json::Value::fromJson("[2,1]", false));
}

BOOST_AUTO_TEST_CASE(test_Value_RepeatedKey) {
    // A repeated key keeps the last value. The parser takes the map node before it reads the
    // value, so the check is that the second one lands on top of the first rather than beside it.
    {
        json::Value v = json::Value::fromJson(R"({"a": 1, "b": 2, "a": [3, 4]})", false);
        BOOST_REQUIRE(v.isObject());
        BOOST_CHECK(v.toObject().size() == 2);
        BOOST_REQUIRE(v["a"].isArray());
        BOOST_CHECK(v["a"][1].toInt() == 4);
        BOOST_CHECK(v["b"].toInt() == 2);
    }
    // The other direction, where what is replaced owns something.
    {
        json::Value v = json::Value::fromJson(R"({"a": {"x": [1, 2]}, "a": null})", false);
        BOOST_REQUIRE(v.isObject());
        BOOST_CHECK(v.toObject().size() == 1);
        BOOST_CHECK(v["a"].isNull());
    }
}

BOOST_AUTO_TEST_CASE(test_Value_Parse) {
    // A parse failure leaves a null value behind and fills in the message.
    {
        json::ParseError error;
        json::Value v = json::Value::fromJson("{not json", false, &error);
        BOOST_CHECK(v.isNull());
        BOOST_CHECK(bool(error));
    }
    // The error output is optional.
    {
        BOOST_CHECK(json::Value::fromJson("{not json", false).isNull());
    }
    // A successful parse leaves the message untouched.
    {
        json::ParseError error;
        json::Value v = json::Value::fromJson(R"({"a": 1})", false, &error);
        BOOST_CHECK(v.isObject());
        BOOST_CHECK(!error);
    }
    // Comments are a parse error unless asked for.
    {
        const std::string_view withComments = R"({"a": 1 /* note */, "b": 2 })";
        BOOST_CHECK(json::Value::fromJson(withComments, false).isNull());

        json::Value v = json::Value::fromJson(withComments, true);
        BOOST_REQUIRE(v.isObject());
        BOOST_CHECK(v["a"].toInt() == 1);
        BOOST_CHECK(v["b"].toInt() == 2);
    }
}

BOOST_AUTO_TEST_CASE(test_Value_ParseErrorSaysWhichAndWhere) {
    const auto &codeOf = [](std::string_view text, bool comments = false) {
        json::ParseError error;
        json::Value::fromJson(text, comments, &error);
        return error.code;
    };

    BOOST_CHECK(codeOf("") == json::ParseError::UnexpectedEnd);
    BOOST_CHECK(codeOf("[1,") == json::ParseError::UnexpectedEnd);
    BOOST_CHECK(codeOf("[1 2]") == json::ParseError::UnexpectedToken);
    BOOST_CHECK(codeOf("01") == json::ParseError::IllegalNumber);

    // Named for the reason given in test_Value_Escapes.
    const std::string meaninglessEscape = R"("\q")";
    BOOST_CHECK(codeOf(meaninglessEscape) == json::ParseError::IllegalEscape);

    BOOST_CHECK(codeOf("\"\t\"") == json::ParseError::IllegalString);
    BOOST_CHECK(codeOf("1 2") == json::ParseError::TrailingContent);

    // The one a caller can act on: the same text parses with comments asked for.
    {
        const std::string_view text = R"({"a": 1 /* note */})";
        BOOST_CHECK(codeOf(text) == json::ParseError::CommentNotAllowed);
        BOOST_CHECK(codeOf(text, true) == json::ParseError::NoError);
    }

    // CBOR keeps its own codes, and an offset with no line to put it on.
    {
        cbor::DecodeError error;
        const uint8_t truncated[] = {0x82, 0x01};
        json::Value::fromCbor(truncated, &error);
        BOOST_CHECK(error.code == cbor::DecodeError::UnexpectedEnd);
        BOOST_CHECK_EQUAL(error.offset, 1u); // the length that cannot be met
        BOOST_CHECK(error.message().find("byte 1") != std::string::npos);

        const uint8_t tagged[] = {0xC0, 0x01};
        json::Value::fromCbor(tagged, &error);
        BOOST_CHECK(error.code == cbor::DecodeError::UnsupportedType);
    }
}

BOOST_AUTO_TEST_CASE(test_Value_ParseClearsOldErrors) {
    json::ParseError error;
    error.code = json::ParseError::UnexpectedEnd;
    BOOST_CHECK(json::Value::fromJson("null", false, &error).isNull());
    BOOST_CHECK(!error);

    cbor::DecodeError cborError;
    cborError.code = cbor::DecodeError::UnexpectedEnd;
    BOOST_CHECK_EQUAL(json::Value::fromCbor(json::Value(42).toCbor(), &cborError).toInt(), 42);
    BOOST_CHECK(!cborError);

    BOOST_CHECK(json::Value::fromJson("{not json", false, &error).isNull());
    BOOST_CHECK(bool(error));

    const uint8_t garbage[] = {0xFF};
    BOOST_CHECK(json::Value::fromCbor(garbage, &cborError).isNull());
    BOOST_CHECK(bool(cborError));
}

BOOST_AUTO_TEST_CASE(test_Value_Serialize) {
    // Keys come out sorted, since the underlying container is ordered.
    {
        json::Value v = json::Value::fromJson(R"({"b": 2, "a": 1})", false);
        BOOST_CHECK(v.toJson() == R"({"a":1,"b":2})");
    }
    // A positive indent switches to the multi-line form.
    {
        json::Value v = json::Value::fromJson(R"({"a":1})", false);
        BOOST_CHECK(v.toJson(2) == "{\n  \"a\": 1\n}");
    }
    {
        BOOST_CHECK(json::Value().toJson() == "null");
        BOOST_CHECK(json::Value(true).toJson() == "true");
        BOOST_CHECK(json::Value("s").toJson() == R"("s")");
        BOOST_CHECK(json::Value(json::Array{}).toJson() == "[]");
        BOOST_CHECK(json::Value(json::Object{}).toJson() == "{}");
    }
}

// Text in, structure out, text back.
BOOST_AUTO_TEST_CASE(test_Value_RoundTrip) {
    const std::string_view text = R"({
        "string": "value",
        "escaped": "quote \" backslash \\ newline \n unicode é",
        "int": -7,
        "uint": 7,
        "double": 1.25,
        "true": true,
        "false": false,
        "null": null,
        "emptyArray": [],
        "emptyObject": {},
        "array": [1, "two", 3.0, null, true, [4, 5], {"deep": "deeper"}],
        "object": {"nested": {"deeper": {"deepest": [1, 2, 3]}}}
    })";

    json::Value parsed = json::Value::fromJson(text, false);
    BOOST_REQUIRE(parsed.isObject());

    // Serializing and parsing again must land on an equal value.
    json::Value reparsed = json::Value::fromJson(parsed.toJson(), false);
    BOOST_CHECK(reparsed == parsed);
    BOOST_CHECK(reparsed.toJson() == parsed.toJson());

    BOOST_CHECK(parsed["escaped"].toString().find('\n') != std::string::npos);
    BOOST_CHECK(parsed["array"].toArray().size() == 7);
    BOOST_CHECK(parsed["array"][5][1].toInt() == 5);
    BOOST_CHECK(parsed["array"][6]["deep"].toString() == "deeper");
    BOOST_CHECK(parsed["object"]["nested"]["deeper"]["deepest"][2].toInt() == 3);
    BOOST_CHECK(parsed["emptyArray"].isArray());
    BOOST_CHECK(parsed["emptyObject"].isObject());
    BOOST_CHECK(parsed["null"].isNull());
    BOOST_CHECK(parsed["true"].toBool() == true);
    BOOST_CHECK(parsed["false"].toBool(true) == false);

    // Walking the exposed containers must agree with subscripting.
    const json::Object &obj = parsed.toObject();
    BOOST_CHECK(obj.size() == 12);
    BOOST_CHECK(obj.find("string") != obj.end());
    BOOST_CHECK(obj.find("absent") == obj.end());
    for (const auto &item : obj) {
        BOOST_CHECK(item.second == parsed[item.first]);
    }

    const json::Array &arr = parsed["array"].toArray();
    for (size_t i = 0; i < arr.size(); ++i) {
        BOOST_CHECK(arr[i] == parsed["array"][i]);
    }
}

BOOST_AUTO_TEST_CASE(test_Value_Cbor) {
    json::Value v = json::Value::fromJson(R"({"a": [1, 2.5, "three"], "b": {"c": true}})", false);
    BOOST_REQUIRE(v.isObject());

    BOOST_CHECK(json::Value::fromCbor(v.toCbor()) == v);

    // Binary survives CBOR, which is the reason for having it at all - it has no JSON text form.
    {
        const uint8_t raw[] = {0xDE, 0xAD, 0xBE, 0xEF};
        json::Value bin(raw, 4);
        json::Value back = json::Value::fromCbor(bin.toCbor());
        BOOST_REQUIRE(back.type() == json::Type::Binary);
        BOOST_CHECK(back.toBinary() == bin.toBinary());
    }
    // Malformed input reports rather than throws.
    {
        const uint8_t garbage[] = {0xFF, 0xFF, 0xFF};
        cbor::DecodeError error;
        json::Value back = json::Value::fromCbor(stdc::array_view<uint8_t>(garbage, 3), &error);
        BOOST_CHECK(back.isNull());
        BOOST_CHECK(bool(error));
    }
    // A declared container count cannot exceed the bytes that remain. Reject it before using the
    // untrusted count to reserve storage.
    {
        const uint8_t impossibleArray[] = {0x9B, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
        cbor::DecodeError error;
        json::Value back = json::Value::fromCbor(impossibleArray, &error);
        BOOST_CHECK(back.isNull());
        BOOST_CHECK(bool(error));
    }
}

BOOST_AUTO_TEST_CASE(test_Value_ValueSemantics) {
    json::Value original = json::Value::fromJson(R"({"a": [1, 2], "b": "text"})", false);

    // Copying is deep enough that the two are independent, which for an immutable value shows as
    // equality that survives the source going away.
    {
        json::Value copy(original);
        BOOST_CHECK(copy == original);

        json::Value assigned;
        assigned = original;
        BOOST_CHECK(assigned == original);
    }
    // Moving carries the contents across.
    {
        json::Value source = original;
        json::Value moved(std::move(source));
        BOOST_CHECK(moved == original);

        json::Value source2 = original;
        json::Value moveAssigned;
        moveAssigned = std::move(source2);
        BOOST_CHECK(moveAssigned == original);
    }
    // Swap exchanges the two.
    {
        json::Value a("first");
        json::Value b(2);
        a.swap(b);
        BOOST_CHECK(a.toInt() == 2);
        BOOST_CHECK(b.toString() == "first");
    }
    // Self assignment must not corrupt the value.
    {
        json::Value v = original;
        const json::Value &alias = v;
        v = alias;
        BOOST_CHECK(v == original);
    }
    // A container built by hand behaves the same as a parsed one.
    {
        json::Object obj;
        obj["a"] = json::Array{json::Value(1), json::Value(2)};
        obj["b"] = json::Value("text");
        BOOST_CHECK(json::Value(std::move(obj)) == original);
    }
}

// Escapes, which are where a reader is most likely to be wrong.
BOOST_AUTO_TEST_CASE(test_Value_Escapes) {
    auto parse = [](std::string_view text) {
        return json::Value::fromJson(text, false)["k"].toString();
    };

    BOOST_CHECK(parse(R"({"k":"A"})") == "A");
    BOOST_CHECK(parse(R"({"k":"\b\f\n\r\t"})") == "\b\f\n\r\t");

    // Named rather than written in place. MSVC's preprocessor re-reads a raw string in a macro
    // argument as an ordinary one, and then warns (C4129) about the escapes a raw string does not
    // have. Only the ones C does not recognise draw it, which is why the line above is fine.
    const std::string escapedSolidus = R"({"k":"\/"})";
    BOOST_CHECK(parse(escapedSolidus) == "/");

    // A code point outside the basic plane arrives as a surrogate pair and has to be put back
    // together before it is encoded.
    BOOST_CHECK(parse(R"({"k":"😀"})") == "\xF0\x9F\x98\x80");

    // Two bytes for U+00E9, three for U+4E2D.
    BOOST_CHECK(parse(R"({"k":"é"})") == "\xC3\xA9");
    BOOST_CHECK(parse(R"({"k":"中"})") == "\xE4\xB8\xAD");

    // A round trip through text has to preserve all of it.
    json::Value v = json::Value::fromJson(R"({"k":"😀  \" \\ é"})", false);
    BOOST_CHECK(json::Value::fromJson(v.toJson(), false) == v);

    // A control character with no short form of its own comes out as a \u escape, printable text
    // does not. The backslash is spelled char(92) so that nothing here depends on how escapes nest.
    {
        const std::string bs(1, char(92));
        BOOST_CHECK(json::Value(std::string(1, char(7))).toJson() == "\"" + bs + "u0007\"");
        BOOST_CHECK(json::Value(std::string(1, char(10))).toJson() == "\"" + bs + "n\"");
    }
    BOOST_CHECK(json::Value(std::string("é")).toJson() == "\"é\"");
}

// Input a reader has to turn away rather than accept and misread.
BOOST_AUTO_TEST_CASE(test_Value_Rejects) {
    auto rejected = [](std::string_view text) {
        json::ParseError error;
        json::Value v = json::Value::fromJson(text, false, &error);
        return v.isNull() && error;
    };

    BOOST_CHECK(rejected(""));
    BOOST_CHECK(rejected("   "));
    BOOST_CHECK(rejected("nul"));
    BOOST_CHECK(rejected("{\"a\":1} trailing"));
    BOOST_CHECK(rejected("[1,2"));
    BOOST_CHECK(rejected("[1,]"));
    BOOST_CHECK(rejected("{\"a\"}"));
    BOOST_CHECK(rejected("{a:1}"));
    BOOST_CHECK(rejected("\"unterminated"));
    BOOST_CHECK(rejected("\"a\tb\""));  // a raw tab inside a string
    BOOST_CHECK(rejected(R"("\u12")")); // too few hexadecimal digits

    // Named for the reason given in test_Value_Escapes: \q is not an escape C knows, so MSVC
    // warns about it even though a raw string has no escapes at all.
    const std::string meaninglessEscape = R"("\q")";
    BOOST_CHECK(rejected(meaninglessEscape));

    // Written the long way round: a universal character name is still looked at inside a raw
    // string literal, and neither of these is a character.
    BOOST_CHECK(rejected("\"\\ud83d\"")); // a high surrogate with nothing after it
    BOOST_CHECK(rejected("\"\\ude00\"")); // a low surrogate on its own
    BOOST_CHECK(rejected("01"));
    BOOST_CHECK(rejected("1."));
    BOOST_CHECK(rejected(".1"));
    BOOST_CHECK(rejected("1e"));
    BOOST_CHECK(rejected("+1"));
    BOOST_CHECK(rejected("\"\xFF\xFE\"")); // not valid UTF-8

    // Nesting deep enough to run out of stack is refused rather than attempted.
    BOOST_CHECK(rejected(std::string(5000, '[')));

    // Depth within the limit still parses.
    {
        const int depth = 100;
        std::string text = std::string(size_t(depth), '[') + std::string(size_t(depth), ']');
        BOOST_CHECK(json::Value::fromJson(text, false).isArray());
    }
}

BOOST_AUTO_TEST_CASE(test_Value_Comments) {
    const std::string_view text = R"({
        // a line comment
        "a": 1, /* and a block one */
        "b": 2 // at the end
    })";

    BOOST_CHECK(json::Value::fromJson(text, false).isNull());

    json::Value v = json::Value::fromJson(text, true);
    BOOST_REQUIRE(v.isObject());
    BOOST_CHECK(v["a"].toInt() == 1);
    BOOST_CHECK(v["b"].toInt() == 2);

    // A comment that never closes is an error, not a value.
    BOOST_CHECK(json::Value::fromJson("/* unterminated", true).isNull());
}

BOOST_AUTO_TEST_CASE(test_Value_Numbers) {
    // The written form decides the type, which is what a round trip has to preserve.
    {
        json::Value v = json::Value::fromJson(R"([1, -1, 1.0, 1e2, -0.0])", false);
        const json::Array &a = v.toArray();
        BOOST_REQUIRE(a.size() == 5);
        BOOST_CHECK(a[0].type() == json::Type::Int);
        BOOST_CHECK(a[1].type() == json::Type::Int);
        BOOST_CHECK(a[2].type() == json::Type::Double);
        BOOST_CHECK(a[3].type() == json::Type::Double);
        BOOST_CHECK(a[4].type() == json::Type::Double);

        // An integral double keeps its point, or it comes back as an integer.
        BOOST_CHECK(v.toJson() == "[1,-1,1.0,100.0,-0.0]");
    }
    // Comparison ignores the distinction the types keep.
    {
        BOOST_CHECK(json::Value(int64_t(1)) == json::Value(uint64_t(1)));
        BOOST_CHECK(json::Value(int64_t(1)) == json::Value(1.0));
        BOOST_CHECK(json::Value(int64_t(-1)) != json::Value(uint64_t(1)));
    }
    // The ends of the integer range survive a round trip exactly, which is the whole reason for
    // keeping integers apart from doubles.
    {
        for (int64_t i : {INT64_MIN, INT64_MAX, int64_t(9007199254740993)}) {
            json::Value v(i);
            json::Value back = json::Value::fromJson(v.toJson(), false);
            BOOST_CHECK(back.type() == json::Type::Int);
            BOOST_CHECK(back.toInt() == i);
        }
    }
    // Past that range there is nothing left to be exact with, so it becomes a double rather than a
    // parse error.
    {
        BOOST_CHECK(json::Value::fromJson("9223372036854775808", false).type() ==
                    json::Type::Double);
        BOOST_CHECK(json::Value::fromJson("123456789012345678901234567890", false).type() ==
                    json::Type::Double);
    }
    // Doubles have to come back bit for bit.
    {
        const double values[] = {0.1, 1.0 / 3.0, 1e-300, 1e300, 3.141592653589793};
        for (double d : values) {
            json::Value v(d);
            BOOST_CHECK(json::Value::fromJson(v.toJson(), false).toDouble() == d);
        }
    }
}

BOOST_AUTO_TEST_CASE(test_Value_Indent) {
    json::Value v = json::Value::fromJson(R"({"a":[1,2],"b":{"c":null}})", false);

    BOOST_CHECK(v.toJson(2) == "{\n"
                               "  \"a\": [\n"
                               "    1,\n"
                               "    2\n"
                               "  ],\n"
                               "  \"b\": {\n"
                               "    \"c\": null\n"
                               "  }\n"
                               "}");

    // An empty container stays on one line whatever the indent.
    BOOST_CHECK(json::Value::fromJson(R"({"a":[],"b":{}})", false).toJson(2) ==
                "{\n  \"a\": [],\n  \"b\": {}\n}");
}

BOOST_AUTO_TEST_CASE(test_Value_CborShapes) {
    auto roundTrip = [](const json::Value &v) { return json::Value::fromCbor(v.toCbor()) == v; };

    BOOST_CHECK(roundTrip(json::Value()));
    BOOST_CHECK(roundTrip(json::Value(true)));
    BOOST_CHECK(roundTrip(json::Value(false)));
    BOOST_CHECK(roundTrip(json::Value(json::Array{})));
    BOOST_CHECK(roundTrip(json::Value(json::Object{})));
    BOOST_CHECK(roundTrip(json::Value(std::string())));
    BOOST_CHECK(roundTrip(json::Value(std::string("中文 é"))));

    // Every width the integer encoding has, on both sides of zero.
    {
        const int64_t signedValues[] = {-1, -24, -25, -256, -65536, -4294967296LL, INT64_MIN};
        for (int64_t i : signedValues) {
            BOOST_CHECK(roundTrip(json::Value(i)));
        }
        const uint64_t unsignedValues[] = {0, 23, 24, 255, 256, 65535, 65536, INT64_MAX};
        for (uint64_t u : unsignedValues) {
            BOOST_CHECK(roundTrip(json::Value(u)));
        }
    }
    BOOST_CHECK(roundTrip(json::Value(0.1)));

    // A truncated encoding reports rather than reads past the end.
    {
        json::Value v = json::Value::fromJson(R"({"a":[1,2,3]})", false);
        auto encoded = v.toCbor();
        encoded.resize(encoded.size() - 1);
        cbor::DecodeError error;
        BOOST_CHECK(json::Value::fromCbor(encoded, &error).isNull());
        BOOST_CHECK(bool(error));
    }
    // Bytes past the end of the value are not silently dropped.
    {
        auto encoded = json::Value(1).toCbor();
        encoded.push_back(0x02);
        cbor::DecodeError error;
        BOOST_CHECK(json::Value::fromCbor(encoded, &error).isNull());
        BOOST_CHECK(bool(error));
    }
}

/// The half-precision test vectors from RFC 8949 appendix A.
///
/// We never write one, since a double is what a json::Value holds. Other encoders do write them,
/// and 0xF9 was the one initial byte of major type 7 that nothing here had ever handed over.
BOOST_AUTO_TEST_CASE(test_Value_CborHalfPrecision) {
    auto decode = [](uint8_t hi, uint8_t lo) {
        const std::vector<uint8_t> buffer{0xF9, hi, lo};
        auto v = json::Value::fromCbor(buffer);
        BOOST_REQUIRE(v.isDouble());
        return v.toDouble();
    };

    BOOST_CHECK_EQUAL(decode(0x00, 0x00), 0.0);
    BOOST_CHECK_EQUAL(decode(0x3C, 0x00), 1.0);
    BOOST_CHECK_EQUAL(decode(0x3E, 0x00), 1.5);
    BOOST_CHECK_EQUAL(decode(0x7B, 0xFF), 65504.0);
    BOOST_CHECK_EQUAL(decode(0xC4, 0x00), -4.0);

    // The sign bit is read separately from the magnitude, so a negative zero stays one rather
    // than becoming the zero the comparison alone cannot tell it from.
    BOOST_CHECK_EQUAL(decode(0x80, 0x00), 0.0);
    BOOST_CHECK(std::signbit(decode(0x80, 0x00)));
    BOOST_CHECK(!std::signbit(decode(0x00, 0x00)));

    // The two exponents that are not an exponent. Subnormal, where the leading bit is absent,
    // and all ones, where the mantissa says which of infinity and a NaN it is.
    BOOST_CHECK_EQUAL(decode(0x00, 0x01), 5.960464477539063e-8);
    BOOST_CHECK_EQUAL(decode(0x04, 0x00), 0.00006103515625);
    BOOST_CHECK(std::isinf(decode(0x7C, 0x00)) && decode(0x7C, 0x00) > 0);
    BOOST_CHECK(std::isinf(decode(0xFC, 0x00)) && decode(0xFC, 0x00) < 0);
    BOOST_CHECK(std::isnan(decode(0x7E, 0x00)));

    // And two bytes are what it takes, so one is a truncated value rather than a zero.
    {
        const std::vector<uint8_t> buffer{0xF9, 0x3C};
        cbor::DecodeError error;
        BOOST_CHECK(json::Value::fromCbor(buffer, &error).isNull());
        BOOST_CHECK(bool(error));
    }
}

/// The test vectors from RFC 8949 appendix A for the lengths that are not given up front.
///
/// We never write one. Other encoders do, so we have to be able to read one.
BOOST_AUTO_TEST_CASE(test_Value_CborIndefiniteLength) {
    auto decode = [](std::initializer_list<uint8_t> bytes) {
        const std::vector<uint8_t> buffer(bytes);
        return json::Value::fromCbor(buffer);
    };

    // (_ h'0102', h'030405') -- the pieces join into one byte string.
    {
        const auto v = decode({0x5F, 0x42, 0x01, 0x02, 0x43, 0x03, 0x04, 0x05, 0xFF});
        BOOST_REQUIRE(v.type() == json::Type::Binary);
        BOOST_CHECK(v.toBinary() == std::vector<uint8_t>({1, 2, 3, 4, 5}));
    }
    // (_ "strea", "ming")
    {
        const auto v =
            decode({0x7F, 0x65, 0x73, 0x74, 0x72, 0x65, 0x61, 0x64, 0x6D, 0x69, 0x6E, 0x67, 0xFF});
        BOOST_REQUIRE(v.isString());
        BOOST_CHECK(v.toString() == "streaming");
    }
    // An empty one still ends where it says it does.
    BOOST_CHECK(decode({0x5F, 0xFF}).toBinary().empty());
    BOOST_CHECK(decode({0x7F, 0xFF}).toString().empty());
    BOOST_CHECK(decode({0x9F, 0xFF}) == json::Value(json::Array{}));
    BOOST_CHECK(decode({0xBF, 0xFF}) == json::Value(json::Object{}));

    // [_ 1, [2, 3], [_ 4, 5]] -- the two forms nest inside one another either way round.
    {
        const auto expected = json::Value::fromJson("[1,[2,3],[4,5]]", false);
        BOOST_CHECK(decode({0x9F, 0x01, 0x82, 0x02, 0x03, 0x9F, 0x04, 0x05, 0xFF, 0xFF}) ==
                    expected);
        BOOST_CHECK(decode({0x9F, 0x01, 0x82, 0x02, 0x03, 0x82, 0x04, 0x05, 0xFF}) == expected);
        BOOST_CHECK(decode({0x83, 0x01, 0x82, 0x02, 0x03, 0x9F, 0x04, 0x05, 0xFF}) == expected);
        BOOST_CHECK(decode({0x83, 0x01, 0x9F, 0x02, 0x03, 0xFF, 0x82, 0x04, 0x05}) == expected);
    }
    // {_ "a": 1, "b": [_ 2, 3]}
    BOOST_CHECK(decode({0xBF, 0x61, 0x61, 0x01, 0x61, 0x62, 0x9F, 0x02, 0x03, 0xFF, 0xFF}) ==
                json::Value::fromJson(R"({"a":1,"b":[2,3]})", false));
    // ["a", {_ "b": "c"}]
    BOOST_CHECK(decode({0x82, 0x61, 0x61, 0xBF, 0x61, 0x62, 0x61, 0x63, 0xFF}) ==
                json::Value::fromJson(R"(["a",{"b":"c"}])", false));

    // What is ill formed stays ill formed.
    auto rejected = [](std::initializer_list<uint8_t> bytes) {
        const std::vector<uint8_t> buffer(bytes);
        cbor::DecodeError error;
        return json::Value::fromCbor(buffer, &error).isNull() && error;
    };

    // A piece of an indefinite-length string cannot itself be indefinite, which is where the
    // fuzzer corpus in nlohmann/json_test_data ends up.
    BOOST_CHECK(rejected({0x5F, 0x5F, 0x41, 0x01, 0xFF, 0xFF}));
    // Nor can it be a string of another kind.
    BOOST_CHECK(rejected({0x5F, 0x61, 0x61, 0xFF}));
    BOOST_CHECK(rejected({0x7F, 0x41, 0x01, 0xFF}));
    // Nor anything that is not a string at all.
    BOOST_CHECK(rejected({0x5F, 0x01, 0xFF}));
    // A break has to end something.
    BOOST_CHECK(rejected({0xFF}));
    BOOST_CHECK(rejected({0x82, 0x01, 0xFF}));
    // And an integer never had a length to leave out.
    BOOST_CHECK(rejected({0x1F}));
    BOOST_CHECK(rejected({0x3F}));
    // An item that opens and never breaks is not a value.
    BOOST_CHECK(rejected({0x9F, 0x01, 0x02}));
    BOOST_CHECK(rejected({0xBF, 0x61, 0x61, 0x01}));
    BOOST_CHECK(rejected({0x5F, 0x41, 0x01}));
}

// A string is a counted sequence of bytes, not a C string, so a null inside it is just a byte.
BOOST_AUTO_TEST_CASE(test_Value_EmbeddedNull) {
    json::Value parsed = json::Value::fromJson("\"a\\u0000b\"", false);
    BOOST_REQUIRE(parsed.isString());
    BOOST_CHECK(parsed.toString().size() == 3);
    BOOST_CHECK(parsed.toString() == std::string("a\0b", 3));

    // And it has to survive going back out and coming in again.
    json::Value back = json::Value::fromJson(parsed.toJson(), false);
    BOOST_CHECK(back == parsed);
    BOOST_CHECK(back.toString().size() == 3);
}

// What is escaped on the way out, and what is not.
BOOST_AUTO_TEST_CASE(test_Value_EscapesOnOutput) {
    const std::string bs(1, char(92));

    // Delete is a control character to a terminal but not to JSON, so it goes out as it stands.
    BOOST_CHECK(json::Value(std::string(1, char(0x7F))).toJson() == "\"\x7F\"");

    // Every other C0 character without a mnemonic takes the numeric form.
    BOOST_CHECK(json::Value(std::string(1, char(0x1F))).toJson() == "\"" + bs + "u001f\"");

    // Keys go through the same escaping as values, which is easy to write only for values.
    {
        json::Object obj;
        obj[std::string("a\nb")] = json::Value(1);
        BOOST_CHECK(json::Value(std::move(obj)).toJson() == "{\"a" + bs + "nb\":1}");
    }
}

// Text that is not valid UTF-8 still has to come out as something that reads back.
//
// \note This is the one place the implementation makes a choice rather than following the format:
//       serializing cannot report an error, so a bad sequence becomes U+FFFD instead. Without it
//       toJson would be the only accessor that can fail.
BOOST_AUTO_TEST_CASE(test_Value_InvalidUtf8OnOutput) {
    // One of each way a sequence can be wrong: a stray trailing byte, a lead byte with nothing
    // after it, an overlong encoding of a character that has a shorter one, and a surrogate.
    const std::string cases[] = {
        std::string("lone ") + char(0x81) + " trailing",
        std::string("missing ") + char(0xD0) + " trailing",
        std::string("overlong ") + char(0xC0) + char(0x80),
        std::string("surrogate ") + char(0xED) + char(0xA0) + char(0x80),
        std::string("too long ") + char(0xF9) + char(0x80) + char(0x80) + char(0x80) + char(0x80),
    };

    for (const auto &bad : cases) {
        json::Value v(bad);
        std::string text = v.toJson();

        json::ParseError error;
        json::Value back = json::Value::fromJson(text, false, &error);
        BOOST_CHECK_MESSAGE(!error, error.message());
        BOOST_CHECK(back.isString());

        // The replacement character is there in place of what could not be written.
        BOOST_CHECK(back.toString().find("\xEF\xBF\xBD") != std::string::npos);
    }

    // Valid text is left exactly alone, replacement characters included.
    for (const char *good : {"plain ASCII", "with é and 中", "\xEF\xBF\xBD already"}) {
        json::Value v{std::string(good)};
        BOOST_CHECK(json::Value::fromJson(v.toJson(), false).toString() == good);
    }
}

// A value owns its string rather than pointing into the caller's.
BOOST_AUTO_TEST_CASE(test_Value_StringOwnership) {
    char raw[] = "Hello";
    json::Value fromPointer(static_cast<const char *>(raw));
    raw[1] = 'a';
    BOOST_CHECK(fromPointer.toString() == "Hello");

    std::string owned = "Hello";
    json::Value fromString(owned);
    owned[1] = 'a';
    BOOST_CHECK(fromString.toString() == "Hello");
}

// The rest of the ways a document can be wrong, beyond those already covered.
BOOST_AUTO_TEST_CASE(test_Value_MoreRejects) {
    auto rejected = [](const std::string &text) {
        json::ParseError error;
        json::Value v = json::Value::fromJson(text, false, &error);
        return v.isNull() && error;
    };

    BOOST_CHECK(rejected("["));
    BOOST_CHECK(rejected("{"));
    BOOST_CHECK(rejected("[][]"));
    BOOST_CHECK(rejected("fuzzy"));
    BOOST_CHECK(rejected("[2?]"));
    BOOST_CHECK(rejected("[&%!]"));
    BOOST_CHECK(rejected(R"({"a",2})"));
    BOOST_CHECK(rejected(R"({"a":2 "b":3})"));
    BOOST_CHECK(rejected("1e1.0"));
    // Built by hand rather than as a raw string, which MSVC mishandles inside a macro argument
    // once it contains an escaped quote.
    BOOST_CHECK(rejected(std::string("\"abc") + char(92) + "\"def"));

    // An overlong encoding is the classic way to smuggle a character past a check that is looking
    // for its shorter form.
    BOOST_CHECK(rejected("\"" + std::string(1, char(0xC0)) + std::string(1, char(0x80)) + "\""));
    BOOST_CHECK(rejected("\"" + std::string(1, char(0xED)) + std::string(1, char(0xA0)) +
                         std::string(1, char(0x80)) + "\""));

    // Where, which is the only thing making a large document fixable.
    {
        json::ParseError error;
        json::Value::fromJson("{\n  \"valid\": 1,\n  invalid: 2\n}", false, &error);
        BOOST_CHECK(error.code == json::ParseError::UnexpectedToken);
        BOOST_CHECK_EQUAL(error.line, 3u);
        BOOST_CHECK_EQUAL(error.column, 3u);
        BOOST_CHECK_EQUAL(error.offset, 18u); // the i of invalid
        BOOST_CHECK(error.message().find("line 3, column 3") != std::string::npos);
    }
}

/// A byte order mark is nothing in UTF-8, but it is what a Windows editor writes, so a manifest
/// saved from one still has to load.
BOOST_AUTO_TEST_CASE(test_Value_ByteOrderMark) {
    const std::string bom = "\xEF\xBB\xBF";

    BOOST_CHECK(json::Value::fromJson(bom + R"({"a":1})", false) ==
                json::Value::fromJson(R"({"a":1})", false));
    BOOST_CHECK(json::Value::fromJson(bom + "  [1]", false) == json::Value::fromJson("[1]", false));

    // Only at the front, and only one. Anywhere else it is a character in the text, and outside a
    // string that is not a document.
    auto rejected = [](const std::string &text) {
        json::ParseError error;
        return json::Value::fromJson(text, false, &error).isNull() && error;
    };
    BOOST_CHECK(rejected(bom + bom + "[1]"));
    BOOST_CHECK(rejected("[1]" + bom));
    BOOST_CHECK(rejected("[" + bom + "1]"));

    // Inside a string it is U+FEFF like any other character, and stays there.
    {
        const auto v = json::Value::fromJson("\"" + bom + "\"", false);
        BOOST_REQUIRE(v.isString());
        BOOST_CHECK(v.toString() == bom);
    }
}

/// Nesting is bounded, because the parser recurses and a manifest does not have to come from
/// someone who wishes us well.
BOOST_AUTO_TEST_CASE(test_Value_DepthLimit) {
    auto nested = [](int depth) {
        return std::string(size_t(depth), '[') + std::string(size_t(depth), ']');
    };

    json::ParseError error;
    BOOST_CHECK(json::Value::fromJson(nested(400), false, &error).isArray());
    BOOST_CHECK(!error);

    json::Value::fromJson(nested(100000), false, &error);
    BOOST_CHECK(error.code == json::ParseError::NestedTooDeeply);

    // The limit is the same in the other direction, so a document that decodes cannot be one the
    // parser would have turned away.
    cbor::DecodeError cborError;
    std::vector<uint8_t> cbor(100000, 0x9F);
    json::Value::fromCbor(cbor, &cborError);
    BOOST_CHECK(cborError.code == cbor::DecodeError::NestedTooDeeply);
}

// isBool was the one type predicate nothing asked. It has to say no to the numbers, which is
// where a bool would go wrong if the type were kept as an int.
BOOST_AUTO_TEST_CASE(test_is_bool_answers_only_for_a_bool) {
    BOOST_CHECK(stdc::json::Value(true).isBool());
    BOOST_CHECK(stdc::json::Value(false).isBool());

    BOOST_CHECK(!stdc::json::Value().isBool());
    BOOST_CHECK(!stdc::json::Value(0).isBool());
    BOOST_CHECK(!stdc::json::Value(1).isBool());
    BOOST_CHECK(!stdc::json::Value(1.0).isBool());
    BOOST_CHECK(!stdc::json::Value("true").isBool());

    // And through a parse, which is where the distinction has to survive.
    BOOST_CHECK(stdc::json::Value::fromJson("true", false).isBool());
    BOOST_CHECK(!stdc::json::Value::fromJson("1", false).isBool());
}

BOOST_AUTO_TEST_SUITE_END()
