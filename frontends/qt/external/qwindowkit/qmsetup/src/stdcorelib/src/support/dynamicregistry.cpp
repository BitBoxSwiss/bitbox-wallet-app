// SPDX-License-Identifier: MIT

#include "dynamicregistry.h"

#include <map>
#include <mutex>
#include <string>

namespace stdc::detail {

    // A registry declared in a header cannot hold its own singleton: a function-local static in a
    // template has one copy per module, so a plugin would register into a table the host never
    // reads. What is exported is a function, and a function belongs to the library, so every
    // module that shares one copy of it resolves to the same object no matter what its own
    // symbols are doing.
    //
    // What is built here is never destroyed, on purpose. Whichever module asks first is the one
    // that builds it, so a destructor would have to be called through a pointer into that module,
    // and a plugin that asked first and then unloaded would take the process down at exit.
    // Nothing is gained by running it either: the memory goes back at exit regardless, and the
    // entries a destructor would release may belong to code that has already been unloaded.
    void *shared_instance(std::string_view name, void *(*create)()) {
        // As with the type table, there has to be exactly one of these in a process, and the
        // names are owned copies because the module that asked can be unloaded later.
        //
        // Nothing here is ever taken apart. What create() returns is deliberately left alone:
        // the destructor would belong to whichever module asked first, and calling it after that
        // module has been unloaded ends the process at exit, where there is nothing left on the
        // stack to say why.
        static std::mutex lock;
        static std::map<std::string, void *, std::less<>> instances;

        std::lock_guard<std::mutex> guard(lock);
        auto it = instances.find(name);
        if (it == instances.end()) {
            // Under the lock, so two threads racing to be first still get one object between
            // them. create() runs at most once per name.
            it = instances.emplace(std::string(name), create()).first;
        }
        return it->second;
    }

}
