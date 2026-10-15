// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_JSON_H
#define STDCORELIB_JSON_H

#include <cstdint>
#include <functional>
#include <map>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include <stdcorelib/stdc_global.h>
#include <stdcorelib/adt/array_view.h>

/// \defgroup json JSON and CBOR
///
/// stdc::json::Value reads and writes both, over the same tree.

namespace stdc::cbor {

    /// \addtogroup json
    /// @{

    /// Why a CBOR document was turned down, and where.
    ///
    /// The codec itself is json::Value::toCbor() and json::Value::fromCbor(), since one tree
    /// serves both encodings. This sits here rather than beside them because it says what went
    /// wrong with CBOR, and whatever else CBOR grows will want the same home.
    struct STDC_EXPORT DecodeError {
        enum Code {
            NoError = 0,
            UnexpectedEnd,   ///< the bytes stopped in the middle of an item
            IllegalEncoding, ///< a reserved encoding, or one this item is not allowed
            IllegalString,   ///< a text string that is not UTF-8
            OutOfRange,      ///< a number CBOR can write and json::Value cannot hold
            UnsupportedType, ///< tags, and map keys that are not text
            NestedTooDeeply,
            TrailingContent, ///< a whole item, and then more after it
        };

        Code code = NoError;
        size_t offset = 0; ///< bytes from the start
        std::string what;  ///< what was wrong, without the position in front of it

        /// Whether this says a decode failed.
        explicit operator bool() const {
            return code != NoError;
        }

        /// The failure in words, with the byte offset in front of it. Empty for NoError.
        std::string message() const;
    };

    /// @}
}

namespace stdc::json {

    /// \addtogroup json
    /// @{

    class Value;

    using Array = std::vector<Value>;

    using Object = std::map<std::string, Value, std::less<>>;

    /// Which of the eight kinds a Value is.
    ///
    /// \note Scoped, so that the \c Array and \c Object here leave the two names above alone. An
    ///       unscoped enumerator would hide them inside Value and everywhere else in here.
    enum class Type {
        Null = 0,
        Bool,
        Double,
        Int,
        String,
        Binary,
        Array,
        Object,
    };

    /// Why a JSON document was turned down, and where.
    struct STDC_EXPORT ParseError {
        enum Code {
            NoError = 0,
            UnexpectedEnd,   ///< the text stopped in the middle of something
            UnexpectedToken, ///< something was there, and it was not what belongs at that point
            IllegalNumber,   ///< a leading zero, a missing digit, an exponent with nothing in it
            IllegalEscape,   ///< an escape nothing answers to, or a broken surrogate pair
            IllegalString,   ///< a raw control character, or bytes that are not UTF-8
            NestedTooDeeply,
            TrailingContent,   ///< a whole value, and then more after it
            CommentNotAllowed, ///< a comment, where \a ignoreComments was not asked for
        };

        Code code = NoError;
        size_t offset = 0; ///< bytes from the start of the text
        size_t line = 1;   ///< counting from one
        size_t column = 1; ///< counting from one, in bytes rather than code points
        std::string what;  ///< what was wrong, without the position in front of it

        /// Whether this says a parse failed.
        explicit operator bool() const {
            return code != NoError;
        }

        /// The failure in words, with the line and column in front of it. Empty for NoError.
        std::string message() const;
    };

    namespace detail {

        /// The empty objects the readers below hand back where the value holds something else.
        /// @{
        inline const Value &empty_value();
        inline const std::string &empty_string();
        inline const std::vector<uint8_t> &empty_binary();
        inline const Array &empty_array();
        inline const Object &empty_object();
        /// @}

    }

    /// A JSON value, shaped after Qt's.
    ///
    /// The tree is built by construction and read through the \c toXxx() family, which never
    /// fails: an accessor asked for a type the value does not have hands back the default it was
    /// given, and a subscript that finds nothing hands back a null value, so a chain of them
    /// needs no check at each step.
    ///
    /// The \c asXxx() family is the other half. It answers with a pointer into the value's own
    /// storage, or with \c nullptr when the value holds something else, and its non-const forms
    /// are how a document is changed after it has been built. That half needs the check the
    /// first half does not.
    ///
    /// \note A number keeps the form it was written in. \c 1 parses as \c Type::Int and \c 1.0 as
    ///       \c Type::Double, which is what a round trip through toJson() has to preserve.
    ///       Comparison ignores the distinction and compares numerically.
    ///
    ///       An integer is exact, up to the range of \c int64_t. Anything outside it, including an
    ///       unsigned value above \c INT64_MAX, becomes a \c Type::Double and is exact only up to
    ///       2^53.
    class STDC_EXPORT Value {
    public:
        Value(Type = Type::Null);
        Value(bool b);
        Value(double d);
        inline Value(int i) : Value(int64_t(i)) {
        }
        inline Value(uint32_t i) : Value(uint64_t(i)) {
        }
        Value(int64_t i);
        Value(uint64_t u);
        Value(std::string s);
        inline Value(const char *s, int size = -1)
            : Value(size < 0 ? std::string(s) : std::string(s, size)) {
        }
        Value(array_view<uint8_t> bytes);
        Value(std::vector<uint8_t> bytes);
        inline Value(const uint8_t *data, int size) : Value(array_view<uint8_t>(data, size)) {
        }
        Value(const Array &a);
        Value(Array &&a);
        Value(const Object &o);
        Value(Object &&o);
        ~Value();

        Value(const Value &RHS);
        Value(Value &&RHS) noexcept;
        Value &operator=(const Value &RHS);
        inline Value &operator=(Value &&RHS) noexcept {
            swap(RHS);
            return *this;
        }

        void swap(Value &RHS) noexcept;

    public:
        inline Type type() const {
            return _type;
        }
        inline bool isNull() const {
            return type() == Type::Null;
        }
        inline bool isBool() const {
            return type() == Type::Bool;
        }
        inline bool isDouble() const {
            return type() == Type::Double;
        }
        inline bool isInt() const {
            return type() == Type::Int;
        }
        inline bool isNumber() const {
            return isDouble() || isInt();
        }
        inline bool isString() const {
            return type() == Type::String;
        }
        inline bool isArray() const {
            return type() == Type::Array;
        }
        inline bool isObject() const {
            return type() == Type::Object;
        }

    public:
        /// \name Reading, with something to fall back on
        ///
        /// None of these fail. Where the value holds something else the default comes back, and
        /// the two number forms convert into each other, which is the only conversion there is.
        ///
        /// \warning A form that hands back a reference and was given a default hands back a
        ///          reference to that default where the type does not match, so a temporary
        ///          written at the call site is gone by the semicolon. The forms taking no
        ///          default answer with a shared empty object instead and are safe to keep.
        /// \sa The \c asXxx() family below, for the storage itself and for telling a value that
        ///     is absent from one that happens to equal the default.
        /// @{

        inline bool toBool(bool defaultValue = false) const {
            return _type == Type::Bool ? _p.b : defaultValue;
        }
        inline double toDouble(double defaultValue = 0) const {
            switch (_type) {
                case Type::Int:
                    return double(_p.i);
                case Type::Double:
                    return _p.d;
                default:
                    break;
            }
            return defaultValue;
        }
        inline int64_t toInt(int64_t defaultValue = 0) const {
            switch (_type) {
                case Type::Int:
                    return _p.i;
                case Type::Double:
                    // Truncated, not rounded, and undefined once the value is out of range, which
                    // is what a cast does everywhere else too.
                    return int64_t(_p.d);
                default:
                    break;
            }
            return defaultValue;
        }
        inline const std::string &toString() const {
            return _type == Type::String ? *_p.s : detail::empty_string();
        }
        inline const std::string &toString(const std::string &defaultValue) const {
            return _type == Type::String ? *_p.s : defaultValue;
        }
        inline std::string toString(std::string &&defaultValue) const {
            if (_type == Type::String) {
                return *_p.s;
            }
            return std::move(defaultValue);
        }
        inline const std::vector<uint8_t> &toBinary() const {
            return _type == Type::Binary ? *_p.bin : detail::empty_binary();
        }
        inline const std::vector<uint8_t> &
            toBinary(const std::vector<uint8_t> &defaultValue) const {
            return _type == Type::Binary ? *_p.bin : defaultValue;
        }
        inline std::vector<uint8_t> toBinary(std::vector<uint8_t> &&defaultValue) const {
            if (_type == Type::Binary) {
                return *_p.bin;
            }
            return std::move(defaultValue);
        }
        inline const Array &toArray() const {
            return _type == Type::Array ? *_p.arr : detail::empty_array();
        }
        inline const Array &toArray(const Array &defaultValue) const {
            return _type == Type::Array ? *_p.arr : defaultValue;
        }
        inline Array toArray(Array &&defaultValue) const {
            if (_type == Type::Array) {
                return *_p.arr;
            }
            return std::move(defaultValue);
        }
        inline const Object &toObject() const {
            return _type == Type::Object ? *_p.obj : detail::empty_object();
        }
        inline const Object &toObject(const Object &defaultValue) const {
            return _type == Type::Object ? *_p.obj : defaultValue;
        }
        inline Object toObject(Object &&defaultValue) const {
            if (_type == Type::Object) {
                return *_p.obj;
            }
            return std::move(defaultValue);
        }

        inline const Value &operator[](std::string_view key) const {
            if (_type == Type::Object) {
                auto it = _p.obj->find(key);
                if (it != _p.obj->end()) {
                    return it->second;
                }
            }
            return detail::empty_value();
        }
        inline const Value &operator[](size_t i) const {
            if (_type == Type::Array && i < _p.arr->size()) {
                return (*_p.arr)[i];
            }
            return detail::empty_value();
        }

        /// @}

        /// \name Reading the storage itself
        ///
        /// The value's own payload, or \c nullptr where it holds something else. Nothing is
        /// converted and nothing is substituted, which is the whole difference from the \c toXxx()
        /// family above: asDouble() on an \c Int answers with null where toDouble() answers with
        /// the number.
        ///
        /// This is also how to tell a value that is not there from one that happens to equal the
        /// default, which \c toInt(-1) cannot do.
        ///
        /// The non-const forms hand out a writable pointer and are the only way to change a
        /// document once it is built. There is no reference form on purpose: a type that does not
        /// match has nothing to return a reference to, and handing back the shared empty object
        /// would let one caller's write reach every other reader of it.
        ///
        /// \code
        ///   if (auto *o = doc.asObject()) {
        ///       o->emplace("count", json::Value(1));
        ///   }
        /// \endcode
        /// @{

        inline const bool *asBool() const {
            return _type == Type::Bool ? &_p.b : nullptr;
        }
        inline bool *asBool() {
            return _type == Type::Bool ? &_p.b : nullptr;
        }
        inline const int64_t *asInt() const {
            return _type == Type::Int ? &_p.i : nullptr;
        }
        inline int64_t *asInt() {
            return _type == Type::Int ? &_p.i : nullptr;
        }
        inline const double *asDouble() const {
            return _type == Type::Double ? &_p.d : nullptr;
        }
        inline double *asDouble() {
            return _type == Type::Double ? &_p.d : nullptr;
        }
        inline const std::string *asString() const {
            return _type == Type::String ? _p.s : nullptr;
        }
        inline std::string *asString() {
            return _type == Type::String ? _p.s : nullptr;
        }
        inline const std::vector<uint8_t> *asBinary() const {
            return _type == Type::Binary ? _p.bin : nullptr;
        }
        inline std::vector<uint8_t> *asBinary() {
            return _type == Type::Binary ? _p.bin : nullptr;
        }
        inline const Array *asArray() const {
            return _type == Type::Array ? _p.arr : nullptr;
        }
        inline Array *asArray() {
            return _type == Type::Array ? _p.arr : nullptr;
        }
        inline const Object *asObject() const {
            return _type == Type::Object ? _p.obj : nullptr;
        }
        inline Object *asObject() {
            return _type == Type::Object ? _p.obj : nullptr;
        }

        /// @}

    public:
        bool operator==(const Value &RHS) const;
        inline bool operator!=(const Value &RHS) const {
            return !(*this == RHS);
        }

    public:
        /// Returns the serialized JSON text of this value.
        ///
        /// \param indent The number of spaces to indent the JSON text. If negative, no indentation
        ///        is performed.
        std::string toJson(int indent = -1) const;

        /// Returns the value the given JSON text spells.
        ///
        /// \param json The text to parse.
        /// \param ignoreComments Whether comments should be ignored and treated like whitespace
        ///        (true) or yield a parse error (false)
        /// \param error Set to why the text was rejected, or cleared on success. A rejected
        ///        document and the text \c null both come back as a null value, so this tells
        ///        them apart.
        static Value fromJson(std::string_view json, bool ignoreComments,
                              ParseError *error = nullptr);

        std::vector<uint8_t> toCbor() const;

        /// Returns the value the given CBOR encodes.
        ///
        /// \param cbor The bytes to decode.
        /// \param error Set to why the bytes were rejected, or cleared on success. A rejected
        ///        document and an encoded null both come back as a null value, so this tells
        ///        them apart.
        static Value fromCbor(array_view<uint8_t> cbor, cbor::DecodeError *error = nullptr);

    private:
        // The alternatives, all trivially copyable, so the payload moves as one object rather
        // than one member at a time. Which member is live is _type and nothing else.
        //
        // Anything larger than a scalar sits behind a pointer this owns, and is copied when the
        // value is. A std::string alone is wider than everything here put together.
        union Payload {
            bool b;
            int64_t i;
            uint64_t u;
            double d;
            std::string *s;
            std::vector<uint8_t> *bin;
            Array *arr;
            Object *obj;
        };

        Type _type;
        Payload _p;

        // Frees what the live alternative owns, if it owns anything, and becomes null.
        void reset() noexcept;
        void copyFrom(const Value &RHS);
    };

    namespace detail {

        inline const Value &empty_value() {
            static const Value instance;
            return instance;
        }

        inline const std::string &empty_string() {
            static const std::string instance;
            return instance;
        }

        inline const std::vector<uint8_t> &empty_binary() {
            static const std::vector<uint8_t> instance;
            return instance;
        }

        inline const Array &empty_array() {
            static const Array instance;
            return instance;
        }

        inline const Object &empty_object() {
            static const Object instance;
            return instance;
        }

    }

    /// @}
}

#endif // STDCORELIB_JSON_H
