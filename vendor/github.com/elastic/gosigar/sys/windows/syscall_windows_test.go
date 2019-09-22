package windows

import (
	"encoding/binary"
	"os"
	"runtime"
	"syscall"
	"testing"
	"unsafe"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
)

func TestGetProcessImageFileName(t *testing.T) {
	h, err := syscall.OpenProcess(syscall.PROCESS_QUERY_INFORMATION, false, uint32(syscall.Getpid()))
	if err != nil {
		t.Fatal(err)
	}

	filename, err := GetProcessImageFileName(h)
	if err != nil {
		t.Fatal(err)
	}

	t.Logf("GetProcessImageFileName: %v", filename)
}

func TestGetProcessMemoryInfo(t *testing.T) {
	h, err := syscall.OpenProcess(syscall.PROCESS_QUERY_INFORMATION, false, uint32(syscall.Getpid()))
	if err != nil {
		t.Fatal(err)
	}
	counters, err := GetProcessMemoryInfo(h)
	if err != nil {
		t.Fatal(err)
	}

	t.Logf("GetProcessMemoryInfo: ProcessMemoryCountersEx=%+v", counters)
}

func TestGetLogicalDriveStrings(t *testing.T) {
	drives, err := GetLogicalDriveStrings()
	if err != nil {
		t.Fatal(err)
	}

	t.Logf("GetLogicalDriveStrings: %v", drives)
}

func TestGetDriveType(t *testing.T) {
	drives, err := GetLogicalDriveStrings()
	if err != nil {
		t.Fatal(err)
	}

	for _, drive := range drives {
		dt, err := GetDriveType(drive)
		if err != nil {
			t.Fatal(err)
		}

		t.Logf("GetDriveType: drive=%v, type=%v", drive, dt)
	}
}

func TestGetSystemTimes(t *testing.T) {
	idle, kernel, user, err := GetSystemTimes()
	if err != nil {
		t.Fatal(err)
	}

	t.Logf("GetSystemTimes: idle=%v, kernel=%v, user=%v", idle, kernel, user)
}

func TestGlobalMemoryStatusEx(t *testing.T) {
	mem, err := GlobalMemoryStatusEx()
	if err != nil {
		t.Fatal(err)
	}

	t.Logf("GlobalMemoryStatusEx: %+v", mem)
}

func TestEnumProcesses(t *testing.T) {
	pids, err := EnumProcesses()
	if err != nil {
		t.Fatal(err)
	}

	t.Logf("EnumProcesses: %v", pids)
}

func TestGetDiskFreeSpaceEx(t *testing.T) {
	drives, err := GetLogicalDriveStrings()
	if err != nil {
		t.Fatal(err)
	}

	for _, drive := range drives {
		dt, err := GetDriveType(drive)
		if err != nil {
			t.Fatal(err)
		}

		// Ignore CDROM drives. They return an error if the drive is emtpy.
		if dt != DRIVE_CDROM {
			free, total, totalFree, err := GetDiskFreeSpaceEx(drive)
			if err != nil {
				t.Fatal(err)
			}
			t.Logf("GetDiskFreeSpaceEx: %v, %v, %v", free, total, totalFree)
		}
	}
}

func TestGetWindowsVersion(t *testing.T) {
	ver := GetWindowsVersion()
	assert.True(t, ver.Major >= 5)
	t.Logf("GetWindowsVersion: %+v", ver)
}

func TestCreateToolhelp32Snapshot(t *testing.T) {
	handle, err := CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer syscall.CloseHandle(syscall.Handle(handle))

	// Iterate over the snapshots until our PID is found.
	pid := uint32(syscall.Getpid())
	for {
		process, err := Process32Next(handle)
		if errors.Cause(err) == syscall.ERROR_NO_MORE_FILES {
			break
		}
		if err != nil {
			t.Fatal(err)
		}

		t.Logf("CreateToolhelp32Snapshot: ProcessEntry32=%v", process)

		if process.ProcessID == pid {
			assert.EqualValues(t, syscall.Getppid(), process.ParentProcessID)
			return
		}
	}

	assert.Fail(t, "Snapshot not found for PID=%v", pid)
}

func TestNtQuerySystemProcessorPerformanceInformation(t *testing.T) {
	cpus, err := NtQuerySystemProcessorPerformanceInformation()
	if err != nil {
		t.Fatal(err)
	}

	assert.Len(t, cpus, runtime.NumCPU())

	for i, cpu := range cpus {
		assert.NotZero(t, cpu.IdleTime)
		assert.NotZero(t, cpu.KernelTime)
		assert.NotZero(t, cpu.UserTime)

		t.Logf("CPU=%v SystemProcessorPerformanceInformation=%v", i, cpu)
	}
}

func TestNtQueryProcessBasicInformation(t *testing.T) {
	h, err := syscall.OpenProcess(syscall.PROCESS_QUERY_INFORMATION, false, uint32(syscall.Getpid()))
	if err != nil {
		t.Fatal(err)
	}

	info, err := NtQueryProcessBasicInformation(h)
	if err != nil {
		t.Fatal(err)
	}
	defer syscall.CloseHandle(h)
	assert.EqualValues(t, os.Getpid(), info.UniqueProcessID)
	assert.EqualValues(t, os.Getppid(), info.InheritedFromUniqueProcessID)

	t.Logf("NtQueryProcessBasicInformation: %+v", info)
}

func TestGetTickCount64(t *testing.T) {
	uptime, err := GetTickCount64()
	if err != nil {
		t.Fatal(err)
	}
	assert.NotZero(t, uptime)
}

func TestGetUserProcessParams(t *testing.T) {
	h, err := syscall.OpenProcess(syscall.PROCESS_QUERY_INFORMATION|PROCESS_VM_READ, false, uint32(syscall.Getpid()))
	if err != nil {
		t.Fatal(err)
	}
	info, err := NtQueryProcessBasicInformation(h)
	if err != nil {
		t.Fatal(err)
	}
	userProc, err := GetUserProcessParams(h, info)
	if err != nil {
		t.Fatal(err)
	}
	defer syscall.CloseHandle(h)
	assert.NoError(t, err)
	assert.EqualValues(t, os.Getpid(), info.UniqueProcessID)
	assert.EqualValues(t, os.Getppid(), info.InheritedFromUniqueProcessID)
	assert.NotEmpty(t, userProc.CommandLine)
}

func TestGetUserProcessParamsInvalidHandle(t *testing.T) {
	var handle syscall.Handle
	var info = ProcessBasicInformation{PebBaseAddress: uintptr(0)}
	userProc, err := GetUserProcessParams(handle, info)
	assert.EqualValues(t, err.Error(), "The handle is invalid.")
	assert.Empty(t, userProc)
}

func TestReadProcessUnicodeString(t *testing.T) {
	h, err := syscall.OpenProcess(syscall.PROCESS_QUERY_INFORMATION|PROCESS_VM_READ, false, uint32(syscall.Getpid()))
	if err != nil {
		t.Fatal(err)
	}
	defer syscall.CloseHandle(h)
	info, err := NtQueryProcessBasicInformation(h)
	if err != nil {
		t.Fatal(err)
	}
	userProc, err := GetUserProcessParams(h, info)
	if err != nil {
		t.Fatal(err)
	}
	read, err := ReadProcessUnicodeString(h, &userProc.CommandLine)
	if err != nil {
		t.Fatal(err)
	}
	assert.NoError(t, err)
	assert.NotEmpty(t, read)
}

const currentProcessHandle = syscall.Handle(^uintptr(0))

func TestReadProcessUnicodeStringTerminator(t *testing.T) {
	data := []byte{'H', 0, 'E', 0, 'L', 0, 'L', 0, 'O', 0, 0, 0}
	for n := len(data); n >= 0; n-- {
		us := UnicodeString{
			Buffer: uintptr(unsafe.Pointer(&data[0])),
			Size:   uint16(n),
		}
		read, err := ReadProcessUnicodeString(currentProcessHandle, &us)
		if err != nil {
			t.Fatal(err)
		}
		nRead := len(read)
		// Strings must match
		assert.True(t, nRead >= n)
		assert.Equal(t, data[:n], read[:n])
		// result is an array of uint16, can't have odd length.
		assert.True(t, nRead&1 == 0)
		// Must include a zero terminator at the end.
		assert.True(t, nRead >= 2)
		assert.Zero(t, read[nRead-1])
		assert.Zero(t, read[nRead-2])
	}
}

func TestReadProcessUnicodeStringInvalidHandle(t *testing.T) {
	var handle syscall.Handle
	var cmd = UnicodeString{Size: 5, MaximumLength: 400, Buffer: 400}
	read, err := ReadProcessUnicodeString(handle, &cmd)
	assert.EqualValues(t, err.Error(), "The handle is invalid.")
	assert.Empty(t, read)
}

func TestByteSliceToStringSlice(t *testing.T) {
	cmd := syscall.GetCommandLine()
	b := make([]byte, unsafe.Sizeof(cmd))
	binary.LittleEndian.PutUint16(b, *cmd)
	hes, err := ByteSliceToStringSlice(b)
	assert.NoError(t, err)
	assert.NotEmpty(t, hes)
}

func TestByteSliceToStringSliceEmptyBytes(t *testing.T) {
	b := make([]byte, 0)
	cmd, err := ByteSliceToStringSlice(b)
	assert.NoError(t, err)
	assert.Empty(t, cmd)
}

func mkUtf16bytes(s string) []byte {
	n := len(s)
	b := make([]byte, n*2)
	for idx, val := range s {
		*(*uint16)(unsafe.Pointer(&b[idx*2])) = uint16(val)
	}
	return b
}

func TestByteSliceToStringSliceNotTerminated(t *testing.T) {
	b := mkUtf16bytes("Hello World")
	cmd, err := ByteSliceToStringSlice(b)
	assert.NoError(t, err)
	assert.Len(t, cmd, 2)
	assert.Equal(t, "Hello", cmd[0])
	assert.Equal(t, "World", cmd[1])
}

func TestByteSliceToStringSliceNotOddSize(t *testing.T) {
	b := mkUtf16bytes("BAD")[:5]
	cmd, err := ByteSliceToStringSlice(b)
	assert.NoError(t, err)
	assert.Len(t, cmd, 1)
	// Odd character is dropped
	assert.Equal(t, "BA", cmd[0])
}

func TestReadProcessMemory(t *testing.T) {
	h, err := syscall.OpenProcess(syscall.PROCESS_QUERY_INFORMATION|PROCESS_VM_READ, false, uint32(syscall.Getpid()))
	if err != nil {
		t.Fatal(err)
	}
	info, err := NtQueryProcessBasicInformation(h)
	if err != nil {
		t.Fatal(err)
	}
	pebSize := 0x20 + 8
	if unsafe.Sizeof(uintptr(0)) == 4 {
		pebSize = 0x10 + 8
	}
	defer syscall.CloseHandle(h)
	peb := make([]byte, pebSize)
	nRead, err := ReadProcessMemory(h, info.PebBaseAddress, peb)
	assert.NoError(t, err)
	assert.NotEmpty(t, nRead)
	assert.EqualValues(t, nRead, uintptr(pebSize))
}

// A zero-byte read is a no-op, no error is returned.
func TestReadProcessMemoryZeroByteRead(t *testing.T) {
	peb := make([]byte, 0)
	var h syscall.Handle
	var address uintptr
	nRead, err := ReadProcessMemory(h, address, peb)
	assert.NoError(t, err)
	assert.Empty(t, nRead)
}

func TestReadProcessMemoryInvalidHandler(t *testing.T) {
	peb := make([]byte, 10)
	var h syscall.Handle
	var address uintptr
	nRead, err := ReadProcessMemory(h, address, peb)
	assert.Error(t, err)
	assert.EqualValues(t, err.Error(), "The handle is invalid.")
	assert.Empty(t, nRead)
}

func TestGetAccessPaths(t *testing.T) {
	paths, err := GetAccessPaths()
	if err != nil {
		t.Fatal(err)
	}
	assert.NotEmpty(t, paths)
	assert.True(t, len(paths) >= 1)
}

func TestGetVolumes(t *testing.T) {
	paths, err := GetVolumes()
	if err != nil {
		t.Fatal(err)
	}
	assert.NotEmpty(t, paths)
	assert.True(t, len(paths) >= 1)
}

func TestGetVolumePathsForVolume(t *testing.T) {
	volumes, err := GetVolumes()
	if err != nil {
		t.Fatal(err)
	}
	assert.NotNil(t, volumes)
	assert.True(t, len(volumes) >= 1)
	volumePath, err := GetVolumePathsForVolume(volumes[0])
	if err != nil {
		t.Fatal(err)
	}
	assert.NotNil(t, volumePath)
	assert.True(t, len(volumePath) >= 1)
}
