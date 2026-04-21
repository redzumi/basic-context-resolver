import * as koffi from 'koffi';

export const IID_IAccessible = '{618736E0-3C3D-11CF-810C-00AA00389B71}';
export const IID_IUIAutomation = '{30CBE57D-D9D0-452A-AB13-7AC5AC4825EE}';
export const CLSID_CUIAutomation = '{FF48DBA4-60EF-4201-AA87-54103EEF594E}';

export const OBJID_CLIENT = 0xFFFFFFFC;
export const CHILDID_SELF = 0;
export const COINIT_MULTITHREADED = 0x0;

export const TreeScope_Element = 0x1;
export const TreeScope_Children = 0x2;
export const TreeScope_Descendants = 0x4;
export const ControlType_Edit = 50004;

export const GUID = koffi.struct('GUID', {
  Data1: 'uint32_t',
  Data2: 'uint16_t',
  Data3: 'uint16_t',
  Data4: 'uchar[8]',
});

export function stringToGUID(str: string): GUID {
  const hex = str.replace(/[{}-]/g, '');
  return {
    Data1: parseInt(hex.substring(0, 8), 16),
    Data2: parseInt(hex.substring(8, 12), 16),
    Data3: parseInt(hex.substring(12, 16), 16),
    Data4: [
      parseInt(hex.substring(16, 18), 16),
      parseInt(hex.substring(18, 20), 16),
      parseInt(hex.substring(20, 22), 16),
      parseInt(hex.substring(22, 24), 16),
      parseInt(hex.substring(24, 26), 16),
      parseInt(hex.substring(26, 28), 16),
      parseInt(hex.substring(28, 30), 16),
      parseInt(hex.substring(30, 32), 16),
    ],
  };
}

export const ole32 = koffi.load('ole32.dll');
export const oleacc = koffi.load('oleacc.dll');
export const user32 = koffi.load('user32.dll');

export const CoInitializeEx = ole32.func('long CoInitializeEx(void *pvReserved, ulong dwCoInit)');
export const CoUninitialize = ole32.func('void CoUninitialize()');
export const CoCreateInstance = ole32.func('long CoCreateInstance(GUID *rclsid, void *pUnkOuter, ulong dwClsContext, GUID *riid, void **ppv)');

export const AccessibleObjectFromWindow = oleacc.func('long AccessibleObjectFromWindow(void *hwnd, ulong dwObjectID, GUID *riid, void **ppacc)');

export const GetForegroundWindow = user32.func('void * GetForegroundWindow()');
export const GetWindowThreadProcessId = user32.func('ulong GetWindowThreadProcessId(void *hWnd, ulong *lpdwProcessId)');
