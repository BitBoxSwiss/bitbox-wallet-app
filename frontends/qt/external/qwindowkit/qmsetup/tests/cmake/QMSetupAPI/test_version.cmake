# Version numbers, which every generated resource and config header is built
# out of, so a wrong answer here shows up in a binary rather than in a message.

include(${QMTEST_HARNESS})

# ------------------------------------------------------------------
# qm_parse_version
# ------------------------------------------------------------------

# Four components, which is what a Windows version resource wants.
qm_parse_version(_full "1.2.3.4")
qmtest_equal("a full version keeps all four" "${_full_1}.${_full_2}.${_full_3}.${_full_4}" "1.2.3.4")

# A version with fewer components is filled out with noughts rather than left
# short, so that whatever reads _4 gets a number.
qm_parse_version(_three "1.2.3")
qmtest_equal("a missing fourth is nought" "${_three_1}.${_three_2}.${_three_3}.${_three_4}" "1.2.3.0")

qm_parse_version(_two "1.2")
qmtest_equal("two components are filled out" "${_two_1}.${_two_2}.${_two_3}.${_two_4}" "1.2.0.0")

qm_parse_version(_one "5")
qmtest_equal("one component is filled out" "${_one_1}.${_one_2}.${_one_3}.${_one_4}" "5.0.0.0")

# Anything past the fourth is not somewhere for it to go.
qm_parse_version(_five "1.2.3.4.5")
qmtest_equal("a fifth component is dropped" "${_five_1}.${_five_2}.${_five_3}.${_five_4}" "1.2.3.4")

# Not every component is a single digit.
qm_parse_version(_wide "10.20.30.40")
qmtest_equal("components are not single digits" "${_wide_1}.${_wide_2}.${_wide_3}.${_wide_4}" "10.20.30.40")

# The prefix is what the caller asked for, so two versions can be held at once.
qm_parse_version(_a "1.0.0.0")
qm_parse_version(_b "2.0.0.0")
qmtest_equal("one version does not overwrite another" "${_a_1}/${_b_1}" "1/2")

# ------------------------------------------------------------------
# qm_crop_version
# ------------------------------------------------------------------

qm_crop_version(_c1 "1.2.3.4" 1)
qmtest_equal("cropping to one" "${_c1}" "1")

qm_crop_version(_c2 "1.2.3.4" 2)
qmtest_equal("cropping to two" "${_c2}" "1.2")

qm_crop_version(_c3 "1.2.3.4" 3)
qmtest_equal("cropping to three" "${_c3}" "1.2.3")

qm_crop_version(_c4 "1.2.3.4" 4)
qmtest_equal("cropping to four leaves it alone" "${_c4}" "1.2.3.4")

# Cropping to more than there is fills out rather than stopping short, which is
# the same answer qm_parse_version gives.
qm_crop_version(_grow "1.2" 4)
qmtest_equal("cropping a short version to four fills it out" "${_grow}" "1.2.0.0")

qmtest_report()
