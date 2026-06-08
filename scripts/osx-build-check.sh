#!/bin/bash
# SPDX-License-Identifier: Apache-2.0

EXIT=0

OUTDIR=frontends/qt/build/osx/BitBox.app
QTWEBENGINE=$OUTDIR/Contents/Frameworks/QtWebEngineCore.framework/Versions/Current/Helpers/QtWebEngineProcess.app/Contents/MacOS/QtWebEngineProcess
BITBOX=$OUTDIR/Contents/MacOS/BitBox
LIBSERVER=$OUTDIR/Contents/Frameworks/libserver.so

function inspect {
        echo "Checking: $1"
        otool -hv $1 |grep " PIE" 2>&1 > /dev/null
        PIE=$?

        if [ "$PIE" -eq 0 ];
        then
            echo "PIE found";
        else
            echo "PIE not found";
            EXIT=1;
        fi

        otool -hv $1 |grep " X86_64" 2>&1 > /dev/null
        BARCH=$?
        if [ "$BARCH" -eq 0 ];
        then
            echo "Build arch is 64bit";
        else
            echo "Build arch is not 64bit";
            EXIT=1
        fi

        otool -hv $1 |grep " MH_ALLOW_STACK_EXECUTION" 2>&1 > /dev/null
        NX=$?
        if [ "$NX" -eq 1 ];
        then
            echo "NX appears to be set";
        else
            echo "MH_ALLOW_STACK_EXECUTION found, NX not set";
            EXIT=1
        fi

        otool -Iv $1 |grep '___stack_chk_guard' 2>&1 > /dev/null
        SSP=$?
        if [ "$SSP" -eq 0 ];
        then
            echo "SSP found";
        else
            echo "SSP not found";
            EXIT=1
        fi
}


inspect $BITBOX
inspect $QTWEBENGINE
inspect $LIBSERVER
