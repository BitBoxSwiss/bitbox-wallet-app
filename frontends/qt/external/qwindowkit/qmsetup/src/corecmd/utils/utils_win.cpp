#include "utils.h"

#include <stdcorelib/platform/windows/stdc_windows.h>
#include <stdcorelib/platform/windows/winextra.h>

#include <shlwapi.h>

#include <delayimp.h>

#include <algorithm>
#include <sstream>
#include <filesystem>
#include <stdexcept>
#include <utility>

#include <stdcorelib/str.h>

namespace fs = std::filesystem;

namespace Utils {

    bool isLink(const fs::path &path) {
        // The reparse point attribute rather than whatever the standard library makes of it.
        // MinGW's reports a symlink here as a plain directory, so fs::is_symlink() says no to a
        // link that MSVC's says yes to. A junction carries the attribute as well, and is the
        // other way a directory on Windows turns out to be somewhere else.
        const DWORD attributes = ::GetFileAttributesW(path.c_str());
        return attributes != INVALID_FILE_ATTRIBUTES &&
               (attributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0;
    }

    FileTime fileTime(const fs::path &path) {
        HANDLE hFile = ::CreateFileW(path.wstring().data(), GENERIC_READ, FILE_SHARE_READ, nullptr,
                                     OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (hFile == INVALID_HANDLE_VALUE) {
            throw std::runtime_error("invalid path: \"" + stdc::wstring_conv::to_utf8(path.wstring()) + "\"");
        }

        FILETIME creationTime, lastAccessTime, lastWriteTime;
        if (!::GetFileTime(hFile, &creationTime, &lastAccessTime, &lastWriteTime)) {
            ::CloseHandle(hFile);
            throw std::runtime_error("failed to get file time: \"" +
                                     stdc::wstring_conv::to_utf8(path.wstring()) + "\"");
        }
        ::CloseHandle(hFile);

        FileTime times;
        // ... (convert FILETIMEs to std::chrono::system_clock::time_point and store in times)
        times.accessTime = stdc::windows::fileTimeToTimePoint(lastAccessTime);
        times.modifyTime = stdc::windows::fileTimeToTimePoint(lastWriteTime);
        times.statusChangeTime = stdc::windows::fileTimeToTimePoint(creationTime);

        return times;
    }

    void setFileTime(const fs::path &path, const FileTime &times) {
        HANDLE hFile = ::CreateFileW(path.wstring().data(), FILE_WRITE_ATTRIBUTES, FILE_SHARE_WRITE,
                                     nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (hFile == INVALID_HANDLE_VALUE) {
            throw std::runtime_error("invalid path: \"" + stdc::wstring_conv::to_utf8(path.wstring()) + "\"");
        }

        FILETIME creationTime, lastAccessTime, lastWriteTime;
        lastAccessTime = stdc::windows::timePointToFileTime(times.accessTime);
        lastWriteTime = stdc::windows::timePointToFileTime(times.modifyTime);
        creationTime = stdc::windows::timePointToFileTime(times.statusChangeTime);

        if (!::SetFileTime(hFile, &creationTime, &lastAccessTime, &lastWriteTime)) {
            ::CloseHandle(hFile);
            throw std::runtime_error("failed to set file time: \"" +
                                     stdc::wstring_conv::to_utf8(path.wstring()) + "\"");
        }
        ::CloseHandle(hFile);
    }


    // ================================================================================
    // Modified from windeployqt 5.15.2(Copyright Qt company)
    // ================================================================================
    namespace WindowsDeployQt {

        static inline std::string stringFromRvaPtr(const void *rvaPtr) {
            return static_cast<const char *>(rvaPtr);
        }

        // Helper for reading out PE executable files: Find a section header for an RVA
        // (IMAGE_NT_HEADERS64, IMAGE_NT_HEADERS32).
        template <class ImageNtHeader>
        static const IMAGE_SECTION_HEADER *findSectionHeader(DWORD rva,
                                                             const ImageNtHeader *nTHeader) {
            const IMAGE_SECTION_HEADER *section = IMAGE_FIRST_SECTION(nTHeader);
            const IMAGE_SECTION_HEADER *sectionEnd =
                section + nTHeader->FileHeader.NumberOfSections;
            for (; section < sectionEnd; ++section)
                if (rva >= section->VirtualAddress &&
                    rva < (section->VirtualAddress + section->Misc.VirtualSize))
                    return section;
            return 0;
        }

        // Helper for reading out PE executable files: convert RVA to pointer (IMAGE_NT_HEADERS64,
        // IMAGE_NT_HEADERS32).
        template <class ImageNtHeader>
        inline const void *rvaToPtr(DWORD rva, const ImageNtHeader *nTHeader,
                                    const void *imageBase) {
            const IMAGE_SECTION_HEADER *sectionHdr = findSectionHeader(rva, nTHeader);
            if (!sectionHdr)
                return 0;
            const DWORD delta = sectionHdr->VirtualAddress - sectionHdr->PointerToRawData;
            return static_cast<const char *>(imageBase) + rva - delta;
        }

        // Helper for reading out PE executable files: return word size of a IMAGE_NT_HEADERS64,
        // IMAGE_NT_HEADERS32
        template <class ImageNtHeader>
        static unsigned ntHeaderWordSize(const ImageNtHeader *header) {
            // defines IMAGE_NT_OPTIONAL_HDR32_MAGIC, IMAGE_NT_OPTIONAL_HDR64_MAGIC
            enum { imageNtOptionlHeader32Magic = 0x10b, imageNtOptionlHeader64Magic = 0x20b };
            if (header->OptionalHeader.Magic == imageNtOptionlHeader32Magic)
                return 32;
            if (header->OptionalHeader.Magic == imageNtOptionlHeader64Magic)
                return 64;
            return 0;
        }

        // Helper for reading out PE executable files: Retrieve the NT image header of an
        // executable via the legacy DOS header.
        static IMAGE_NT_HEADERS *getNtHeader(void *fileMemory, std::wstring *errorMessage) {
            IMAGE_DOS_HEADER *dosHeader = static_cast<PIMAGE_DOS_HEADER>(fileMemory);
            // Check DOS header consistency
            if (IsBadReadPtr(dosHeader, sizeof(IMAGE_DOS_HEADER)) ||
                dosHeader->e_magic != IMAGE_DOS_SIGNATURE) {
                *errorMessage = L"DOS header check failed.";
                return 0;
            }
            // Retrieve NT header
            char *ntHeaderC = static_cast<char *>(fileMemory) + dosHeader->e_lfanew;
            IMAGE_NT_HEADERS *ntHeaders = reinterpret_cast<IMAGE_NT_HEADERS *>(ntHeaderC);
            // check NT header consistency
            if (IsBadReadPtr(ntHeaders, sizeof(ntHeaders->Signature)) ||
                ntHeaders->Signature != IMAGE_NT_SIGNATURE ||
                IsBadReadPtr(&ntHeaders->FileHeader, sizeof(IMAGE_FILE_HEADER))) {
                *errorMessage = L"NT header check failed.";
                return 0;
            }
            // Check magic
            if (!ntHeaderWordSize(ntHeaders)) {
                std::wostringstream ss;
                ss << "NT header check failed; magic " << ntHeaders->OptionalHeader.Magic
                   << " is invalid.";
                *errorMessage = ss.str();
                return 0;
            }
            // Check section headers
            IMAGE_SECTION_HEADER *sectionHeaders = IMAGE_FIRST_SECTION(ntHeaders);
            if (IsBadReadPtr(sectionHeaders, ntHeaders->FileHeader.NumberOfSections *
                                                 sizeof(IMAGE_SECTION_HEADER))) {
                *errorMessage = L"NT header section header check failed.";
                return 0;
            }
            return ntHeaders;
        }

        // Helper for reading out PE executable files: Read out import sections from
        // IMAGE_NT_HEADERS64, IMAGE_NT_HEADERS32.
        template <class ImageNtHeader>
        static std::vector<std::string> readImportSections(const ImageNtHeader *ntHeaders,
                                                           const void *base,
                                                           std::wstring *errorMessage) {
            // Get import directory entry RVA and read out
            const DWORD importsStartRVA =
                ntHeaders->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT]
                    .VirtualAddress;
            if (!importsStartRVA) {
                *errorMessage = L"Failed to find IMAGE_DIRECTORY_ENTRY_IMPORT entry.";
                return {};
            }
            const IMAGE_IMPORT_DESCRIPTOR *importDesc =
                static_cast<const IMAGE_IMPORT_DESCRIPTOR *>(
                    rvaToPtr(importsStartRVA, ntHeaders, base));
            if (!importDesc) {
                *errorMessage = L"Failed to find IMAGE_IMPORT_DESCRIPTOR entry.";
                return {};
            }
            std::vector<std::string> result;
            for (; importDesc->Name; ++importDesc)
                result.push_back(stringFromRvaPtr(rvaToPtr(importDesc->Name, ntHeaders, base)));

            // Read delay-loaded DLLs, see http://msdn.microsoft.com/en-us/magazine/cc301808.aspx .
            // Check on grAttr bit 1 whether this is the format using RVA's > VS 6
            if (const DWORD delayedImportsStartRVA =
                    ntHeaders->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_DELAY_IMPORT]
                        .VirtualAddress) {
                const ImgDelayDescr *delayedImportDesc = static_cast<const ImgDelayDescr *>(
                    rvaToPtr(delayedImportsStartRVA, ntHeaders, base));
                for (; delayedImportDesc->rvaDLLName && (delayedImportDesc->grAttrs & 1);
                     ++delayedImportDesc)
                    result.push_back(
                        stringFromRvaPtr(rvaToPtr(delayedImportDesc->rvaDLLName, ntHeaders, base)));
            }

            return result;
        }

        template <class ImageNtHeader>
        static void determineDependentLibs(const ImageNtHeader *nth, const void *fileMemory,
                                           bool isMinGW,
                                           std::vector<std::string> *dependentLibrariesIn,
                                           std::wstring *errorMessage) {
            std::vector<std::string> dependentLibraries;
            if (dependentLibrariesIn)
                dependentLibraries = readImportSections(nth, fileMemory, errorMessage);
            if (dependentLibrariesIn)
                *dependentLibrariesIn = dependentLibraries;
        }

        // Read a PE executable and determine dependent libraries, word size.
        bool readPeExecutable(const std::wstring &peExecutableFileName, std::wstring *errorMessage,
                              std::vector<std::string> *dependentLibrariesIn, unsigned *wordSizeIn,
                              bool isMinGW, unsigned short *machineArchIn) {
            bool result = false;
            HANDLE hFile = NULL;
            HANDLE hFileMap = NULL;
            void *fileMemory = 0;

            if (dependentLibrariesIn)
                dependentLibrariesIn->clear();
            if (wordSizeIn)
                *wordSizeIn = 0;

            do {
                // Create a memory mapping of the file
                hFile = CreateFileW(peExecutableFileName.data(), GENERIC_READ, FILE_SHARE_READ,
                                    NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
                if (hFile == INVALID_HANDLE_VALUE || hFile == NULL) {
                    std::wostringstream ss;
                    ss << L"Cannot open \"" << peExecutableFileName << L"\": "
                       << stdc::windows::systemError(::GetLastError());
                    *errorMessage = ss.str();
                    break;
                }

                hFileMap = CreateFileMappingW(hFile, NULL, PAGE_READONLY, 0, 0, NULL);
                if (hFileMap == NULL) {
                    std::wostringstream ss;
                    ss << L"Cannot create file mapping of \"" << peExecutableFileName << L"\": "
                       << stdc::windows::systemError(::GetLastError());
                    *errorMessage = ss.str();
                    break;
                }

                fileMemory = MapViewOfFile(hFileMap, FILE_MAP_READ, 0, 0, 0);
                if (!fileMemory) {
                    std::wostringstream ss;
                    ss << L"Cannot map \"" << peExecutableFileName << L"\": "
                       << stdc::windows::systemError(::GetLastError());
                    *errorMessage = ss.str();
                    break;
                }

                const IMAGE_NT_HEADERS *ntHeaders = getNtHeader(fileMemory, errorMessage);
                if (!ntHeaders)
                    break;

                const unsigned wordSize = ntHeaderWordSize(ntHeaders);
                if (wordSizeIn)
                    *wordSizeIn = wordSize;
                if (wordSize == 32) {
                    determineDependentLibs(reinterpret_cast<const IMAGE_NT_HEADERS32 *>(ntHeaders),
                                           fileMemory, isMinGW, dependentLibrariesIn, errorMessage);
                } else {
                    determineDependentLibs(reinterpret_cast<const IMAGE_NT_HEADERS64 *>(ntHeaders),
                                           fileMemory, isMinGW, dependentLibrariesIn, errorMessage);
                }

                if (machineArchIn)
                    *machineArchIn = ntHeaders->FileHeader.Machine;

                result = true;
            } while (false);

            if (fileMemory)
                UnmapViewOfFile(fileMemory);

            if (hFileMap != NULL)
                CloseHandle(hFileMap);

            if (hFile != NULL && hFile != INVALID_HANDLE_VALUE)
                CloseHandle(hFile);

            return result;
        }

    }

    std::vector<std::wstring>
        resolveWinBinaryDependencies(const std::filesystem::path &path,
                                     const std::vector<std::filesystem::path> &searchingPaths,
                                     std::vector<std::string> *unparsed) {
        std::wstring errorMessage;
        std::vector<std::string> dependentLibrariesIn;
        unsigned wordSizeIn;
        bool isMinGW = false;
        unsigned short machineArchIn;
        if (!WindowsDeployQt::readPeExecutable(path, &errorMessage, &dependentLibrariesIn,
                                               &wordSizeIn, isMinGW, &machineArchIn)) {
            throw std::runtime_error(stdc::wstring_conv::to_utf8(errorMessage));
        }

        // Search
        std::vector<std::wstring> result;
        for (const auto &item : std::as_const(dependentLibrariesIn)) {
            fs::path fullPath;
            for (const auto &dir : std::as_const(searchingPaths)) {
                fs::path targetPath = dir / item;
                if (fs::exists(targetPath)) {
                    fullPath = targetPath;
                    break;
                }
            }

            if (!fullPath.empty()) {
                result.push_back(fullPath);
                continue;
            }

            if (unparsed) {
                unparsed->push_back(item);
            }
        }
        return result;
    }

}
