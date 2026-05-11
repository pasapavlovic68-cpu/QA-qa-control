export async function runModalSuccessFlow({
  setSaving,
  action,
  reload,
  reset,
  toast,
  close,
  onError,
}) {
  setSaving?.(true);
  try {
    const result = await action();
    if (reload) await reload(result);
    reset?.(result);
    toast?.(result);
    close?.(result);
    return { ok: true, result };
  } catch (error) {
    onError?.(error);
    return { ok: false, error };
  } finally {
    setSaving?.(false);
  }
}
