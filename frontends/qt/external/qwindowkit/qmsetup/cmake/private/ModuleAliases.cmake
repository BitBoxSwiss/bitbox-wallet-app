#[[
    Warning: This file is private, may be modified or removed in the future, please use with caution.
]] #

# What a module used to be called.
#
# A module is renamed by moving the file and adding a row here. Nothing else
# has to happen: qm_import translates the name before it looks for the file, so
# a project written against the old one keeps working and is told once what the
# new one is.
#
# The old name is not a file. A stub module left behind under the old name would
# do the same for qm_import and the wrong thing for qm_import_all, which globs
# the directory and would bring in both, telling a project that never named the
# old one that it is using something deprecated.
#
# Left in place rather than swept up after a while. The cost of a row is one
# line, and what it buys is that nothing downstream has to be edited in step
# with this repository.

set(_qm_module_aliases
    # was          is now
    Qml            QtQml
    Translate      QtLinguist
)

# One variable each, so that asking is asking whether a name is defined rather
# than walking a list on every import.
while(_qm_module_aliases)
    list(POP_FRONT _qm_module_aliases _qm_alias_old _qm_alias_new)
    set(QMSETUP_MODULE_ALIAS_${_qm_alias_old} "${_qm_alias_new}")
endwhile()

unset(_qm_alias_old)
unset(_qm_alias_new)
