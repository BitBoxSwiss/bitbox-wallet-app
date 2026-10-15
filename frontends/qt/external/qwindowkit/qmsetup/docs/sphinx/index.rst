QMSETUP
=======

CMake Modules and Basic Libraries for C/C++ projects.

Finding the package is all the API asks for. Its commands exist from there on.

.. code-block:: cmake

   find_package(qmsetup REQUIRED)

.. toctree::
   :maxdepth: 2

   api

A module is the other half, and none of them is brought in by that alone. Name
the ones wanted as components:

.. code-block:: cmake

   find_package(qmsetup REQUIRED COMPONENTS Deploy)

or import them afterwards, which comes to the same thing:

.. code-block:: cmake

   qm_import(Deploy)

``COMPONENTS All`` takes every module there is.

.. toctree::
   :maxdepth: 2
   :caption: Modules

   modules/Deploy
   modules/Doxygen
   modules/Filesystem
   modules/Preprocess
   modules/Protobuf
   modules/QtLinguist
   modules/QtQml
