export async function openAuthUrl(url: unknown) {
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) return;
  await import("open").then(({ default: open }) => open(url)).catch(() => {});
}
