# The definition list a config header is generated out of.
#
# Everything here works on the global scope, which is the default and the only
# one a script can reach. The target, source and directory scopes need a project
# to exist and are not covered.

include(${QMTEST_HARNESS})

qm_import(Preprocess)

# Both scopes this file uses, so that no check is left standing on what the one
# before it happened to leave behind.
macro(reset)
    set_property(GLOBAL PROPERTY CONFIG_DEFINITIONS "")
    set_property(SOURCE somefile.cpp PROPERTY CONFIG_DEFINITIONS "")
endmacro()

macro(definitions _var)
    get_property(${_var} GLOBAL PROPERTY CONFIG_DEFINITIONS)
endmacro()

# ------------------------------------------------------------------
# The three ways of naming one
# ------------------------------------------------------------------

reset()
qm_add_definition(FOO)
definitions(_d)
qmtest_equal("a key on its own" "${_d}" "FOO")

reset()
qm_add_definition(BAR 42)
definitions(_d)
qmtest_equal("a key and a value" "${_d}" "BAR=42")

reset()
qm_add_definition(BAZ=7)
definitions(_d)
qmtest_equal("a key and a value in one argument" "${_d}" "BAZ=7")

reset()
qm_add_definition(FOO)
qm_add_definition(BAR 42)
qm_add_definition(BAZ)
definitions(_d)
qmtest_equal("they gather in the order they were given" "${_d}" "FOO;BAR=42;BAZ")

# ------------------------------------------------------------------
# A boolean value says whether the key is there at all, rather than
# becoming the value
# ------------------------------------------------------------------

foreach(_yes on true ON TRUE)
    reset()
    qm_add_definition(FEATURE ${_yes})
    definitions(_d)
    qmtest_equal("${_yes} defines the key alone" "${_d}" "FEATURE")
endforeach()

foreach(_no off false OFF FALSE)
    reset()
    qm_add_definition(FEATURE ${_no})
    definitions(_d)
    qmtest_equal("${_no} leaves the key out" "${_d}" "")
endforeach()

# Unless the caller says the value is a value whatever it looks like.
reset()
qm_add_definition(NAME on NO_KEYWORD)
definitions(_d)
qmtest_equal("NO_KEYWORD takes a boolean as the value" "${_d}" "NAME=on")

reset()
qm_add_definition(NAME off NO_KEYWORD)
definitions(_d)
qmtest_equal("NO_KEYWORD takes a false boolean as the value too" "${_d}" "NAME=off")

# ------------------------------------------------------------------
# STRING_LITERAL, for a value the compiler should see quoted
# ------------------------------------------------------------------

reset()
qm_add_definition(NAME hello STRING_LITERAL)
definitions(_d)
qmtest_equal("STRING_LITERAL quotes the value" "${_d}" "NAME=\"hello\"")

reset()
qm_add_definition(NAME "\"hello\"" STRING_LITERAL)
definitions(_d)
qmtest_equal("STRING_LITERAL leaves a quoted value alone" "${_d}" "NAME=\"hello\"")

# ------------------------------------------------------------------
# NUMERICAL, where a key that is not defined is still written out, as
# -1, so that a header always names it
# ------------------------------------------------------------------

reset()
qm_add_definition(FOO NUMERICAL)
definitions(_d)
qmtest_equal("NUMERICAL writes a defined key as one" "${_d}" "FOO=1")

reset()
qm_add_definition(FOO off NUMERICAL)
definitions(_d)
qmtest_equal("NUMERICAL writes an undefined key as minus one" "${_d}" "FOO=-1")

# A key that already carries a value has nothing to say numerically.
reset()
qm_add_definition(BAR 42 NUMERICAL)
definitions(_d)
qmtest_equal("NUMERICAL leaves a value alone" "${_d}" "BAR=42")

reset()
qm_add_definition(BAR=42 NUMERICAL)
definitions(_d)
qmtest_equal("NUMERICAL leaves a one argument value alone" "${_d}" "BAR=42")

# The same, asked for once rather than at every call.
set(QMSETUP_DEFINITION_NUMERICAL on)

reset()
qm_add_definition(FOO)
definitions(_d)
qmtest_equal("the variable turns it on for everything" "${_d}" "FOO=1")

reset()
qm_add_definition(FOO CLASSICAL)
definitions(_d)
qmtest_equal("CLASSICAL overrides the variable" "${_d}" "FOO")

unset(QMSETUP_DEFINITION_NUMERICAL)

# ------------------------------------------------------------------
# CONDITION
# ------------------------------------------------------------------

reset()
qm_add_definition(FOO CONDITION on)
definitions(_d)
qmtest_equal("a condition that holds adds the key" "${_d}" "FOO")

reset()
qm_add_definition(FOO CONDITION off)
definitions(_d)
qmtest_equal("a condition that does not hold leaves it out" "${_d}" "")

reset()
qm_add_definition(BAR 42 CONDITION off)
definitions(_d)
qmtest_equal("a condition that does not hold leaves a pair out" "${_d}" "")

# A false condition turns the meaning around rather than only suppressing it, so
# that a key asked to be off arrives when the condition says otherwise.
reset()
qm_add_definition(FOO off CONDITION off)
definitions(_d)
qmtest_equal("a false condition inverts a false value" "${_d}" "FOO")

reset()
qm_add_definition(FOO on CONDITION off)
definitions(_d)
qmtest_equal("a false condition inverts a true value" "${_d}" "")

reset()
qm_add_definition(FOO CONDITION 1 AND 1)
definitions(_d)
qmtest_equal("a condition of several words" "${_d}" "FOO")

# ------------------------------------------------------------------
# Where it goes
# ------------------------------------------------------------------

reset()
set_property(GLOBAL PROPERTY OTHER_DEFINITIONS "")
qm_add_definition(FOO PROPERTY OTHER_DEFINITIONS)
get_property(_other GLOBAL PROPERTY OTHER_DEFINITIONS)
definitions(_d)
qmtest_equal("PROPERTY names where it goes" "${_other}" "FOO")
qmtest_equal("and it does not go anywhere else" "${_d}" "")

# GLOBAL is the default, so naming it is meant to change nothing.
reset()
qm_add_definition(FOO GLOBAL)
definitions(_d)
qmtest_equal("GLOBAL is a scope rather than a value" "${_d}" "FOO")

# A source file is a scope of its own, which is how a definition reaches one
# translation unit and no others.
reset()
qm_add_definition(FOO SOURCE somefile.cpp)
get_property(_source SOURCE somefile.cpp PROPERTY CONFIG_DEFINITIONS)
definitions(_d)
qmtest_equal("SOURCE names the file it belongs to" "${_source}" "FOO")
qmtest_equal("and it does not reach the global scope" "${_d}" "")

reset()
qm_add_definition(FOO SOURCE somefile.cpp)
qm_add_definition(BAR SOURCE somefile.cpp)
qm_remove_definition(FOO SOURCE somefile.cpp)
get_property(_source SOURCE somefile.cpp PROPERTY CONFIG_DEFINITIONS)
qmtest_equal("removing from the file it belongs to" "${_source}" "BAR")

# ------------------------------------------------------------------
# qm_remove_definition
# ------------------------------------------------------------------

reset()
qm_add_definition(FOO)
qm_add_definition(BAR 42)
qm_add_definition(BAZ)
qm_remove_definition(BAR)
definitions(_d)
qmtest_equal("removing a key with a value leaves the rest" "${_d}" "FOO;BAZ")

reset()
qm_add_definition(FOO)
qm_add_definition(BAR 42)
qm_remove_definition(FOO)
definitions(_d)
qmtest_equal("removing a bare key leaves the rest" "${_d}" "BAR=42")

reset()
qm_add_definition(FOO)
qm_remove_definition(NOTTHERE)
definitions(_d)
qmtest_equal("removing what is not there changes nothing" "${_d}" "FOO")

# The name has to match the whole of it, so one key is not taken for another
# that begins the same way.
reset()
qm_add_definition(FOO)
qm_add_definition(FOOBAR)
qm_remove_definition(FOO)
definitions(_d)
qmtest_equal("a longer key that begins the same way stays" "${_d}" "FOOBAR")

reset()
set_property(GLOBAL PROPERTY OTHER_DEFINITIONS "")
qm_add_definition(FOO PROPERTY OTHER_DEFINITIONS)
qm_add_definition(BAR PROPERTY OTHER_DEFINITIONS)
qm_remove_definition(FOO PROPERTY OTHER_DEFINITIONS)
get_property(_other GLOBAL PROPERTY OTHER_DEFINITIONS)
qmtest_equal("removing from the property it was put in" "${_other}" "BAR")

# ------------------------------------------------------------------
# A call that does not mean anything
# ------------------------------------------------------------------

qmtest_script_fails("a definition of three parts is refused"
    "incorrect number of arguments"
    "qm_import(Preprocess)\nqm_add_definition(A B C)")

qmtest_report()
