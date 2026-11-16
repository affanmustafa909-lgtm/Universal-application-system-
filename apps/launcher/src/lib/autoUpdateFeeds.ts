export type UpdateFeedInfo = {
  id: string;
  label: string;
  localVersion: string;
  publishedVersion: string | null;
  publishedUrl: string | null;
  ok: boolean;
  error?: string;
};

const DESKTOP_REPO = "basir2353/zivra-desktop-updates";
const DISTRIBUTION_REPO = "basir2353/zivra-distribution-updates";
const ICE_CREAM_REPO = "basir2353/ice-cream-bar-updates";
const MOBILE_REPO = "basir2353/zivra-mobile-updates";

const DESKTOP_FEEDS = {
  suite: {
    manifest: "latest-suite.json",
    label: "Desktop · Universal",
    downloadTag: (v: string) =>
      `https://github.com/${DESKTOP_REPO}/releases/download/desktop-v${v}/Zivra-Universal-Management-System_${v}_x64-setup.exe`,
  },
  restaurant: {
    manifest: "latest-restaurant.json",
    label: "Desktop · Restaurant",
    downloadTag: (v: string) =>
      `https://github.com/${DESKTOP_REPO}/releases/download/desktop-v${v}/Zivra-Restaurant-Management-System_${v}_x64-setup.exe`,
  },
  "general-store": {
    manifest: "latest-general-store.json",
    label: "Desktop · General Store",
    downloadTag: (v: string) =>
      `https://github.com/${DESKTOP_REPO}/releases/download/desktop-v${v}/Zivra-General-Store-Management-System_${v}_x64-setup.exe`,
  },
  pharmacy: {
    manifest: "latest-pharmacy.json",
    label: "Desktop · Pharmacy",
    downloadTag: (v: string) =>
      `https://github.com/${DESKTOP_REPO}/releases/download/desktop-v${v}/Zivra-Pharmacy-Management-System_${v}_x64-setup.exe`,
  },
  education: {
    manifest: "latest-education.json",
    label: "Desktop · EducationFlow",
    downloadTag: (v: string) =>
      `https://github.com/${DESKTOP_REPO}/releases/download/desktop-v${v}/EducationFlow-Management-System_${v}_x64-setup.exe`,
  },
  mobizone: {
    manifest: "latest-mobizone.json",
    label: "Desktop · MobiZone",
    downloadTag: (v: string) =>
      `https://github.com/${DESKTOP_REPO}/releases/download/desktop-v${v}/Zivra-MobiZone-ERP_${v}_x64-setup.exe`,
  },
} as const;

const DISTRIBUTION_FEED = {
  manifest: "latest-distribution.json",
  label: "Desktop · Distribution",
  downloadTag: (v: string) =>
    `https://github.com/${DISTRIBUTION_REPO}/releases/download/desktop-v${v}/Zivra-Distribution-System_${v}_x64-setup.exe`,
} as const;

const ICE_CREAM_FEED = {
  manifest: "latest-ice-cream-bar.json",
  label: "Desktop · Ice Cream Bar",
  downloadTag: (v: string) =>
    `https://github.com/${ICE_CREAM_REPO}/releases/download/ice-cream-v${v}/Scoops-Ice-Cream-Bar_${v}_x64-setup.exe`,
} as const;

const MOBILE_FEEDS = {
  admin: {
    manifest: "latest-admin.json",
    label: "Mobile · Admin APK",
    downloadTag: (v: string) =>
      `https://github.com/${MOBILE_REPO}/releases/download/mobile-v${v}/pops-admin-release.apk`,
  },
  staff: {
    manifest: "latest-staff.json",
    label: "Mobile · Staff APK",
    downloadTag: (v: string) =>
      `https://github.com/${MOBILE_REPO}/releases/download/mobile-v${v}/pops-staff-release.apk`,
  },
  mobizone: {
    manifest: "latest-mobizone.json",
    label: "Mobile · Zivra MobiZone APK",
    downloadTag: (v: string) =>
      `https://github.com/${MOBILE_REPO}/releases/download/mobile-v${v}/mobizone-erp-release.apk`,
  },
} as const;

type GhRelease = {
  tag_name?: string;
  assets?: Array<{ name: string; browser_download_url: string }>;
};

function versionFromTag(tag: string, prefix: "desktop" | "mobile" | "ice-cream"): string | null {
  const m = tag.match(new RegExp(`^${prefix}-v(.+)$`, "i"));
  return m?.[1]?.trim() || null;
}

/** GitHub API works in browser; raw release/download URLs often fail CORS from localhost. */
async function fetchGitHubRelease(repo: string): Promise<{ release: GhRelease | null; error?: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return { release: null, error: `HTTP ${res.status}` };
    return { release: (await res.json()) as GhRelease };
  } catch (err) {
    return { release: null, error: err instanceof Error ? err.message : "Fetch failed" };
  }
}

export async function fetchAutoUpdateStatus(input: {
  desktopVersion: string;
  mobileVersion: string;
}): Promise<UpdateFeedInfo[]> {
  const rows: UpdateFeedInfo[] = [];

  const desktop = await fetchGitHubRelease(DESKTOP_REPO);
  const desktopVersion = desktop.release?.tag_name
    ? versionFromTag(desktop.release.tag_name, "desktop")
    : null;

  const iceCream = await fetchGitHubRelease(ICE_CREAM_REPO);
  const iceCreamVersion = iceCream.release?.tag_name
    ? versionFromTag(iceCream.release.tag_name, "ice-cream") ??
      versionFromTag(iceCream.release.tag_name, "desktop")
    : null;
  const iceAsset = iceCream.release?.assets?.find((a) => a.name === ICE_CREAM_FEED.manifest);
  rows.push({
    id: "desktop-ice-cream-bar",
    label: ICE_CREAM_FEED.label,
    localVersion: input.desktopVersion,
    publishedVersion: iceCreamVersion,
    publishedUrl:
      iceAsset?.browser_download_url ??
      (iceCreamVersion ? ICE_CREAM_FEED.downloadTag(iceCreamVersion) : null),
    ok: iceCreamVersion === input.desktopVersion && Boolean(iceAsset),
    error:
      iceCream.error ??
      (!iceAsset && iceCreamVersion ? `Missing ${ICE_CREAM_FEED.manifest} on release` : undefined),
  });

  for (const [id, feed] of Object.entries(DESKTOP_FEEDS)) {
    const asset = desktop.release?.assets?.find((a) => a.name === feed.manifest);
    rows.push({
      id: `desktop-${id}`,
      label: feed.label,
      localVersion: input.desktopVersion,
      publishedVersion: desktopVersion,
      publishedUrl: asset?.browser_download_url ?? (desktopVersion ? feed.downloadTag(desktopVersion) : null),
      ok: desktopVersion === input.desktopVersion && Boolean(asset),
      error: desktop.error ?? (!asset && desktopVersion ? `Missing ${feed.manifest} on release` : undefined),
    });
  }

  const distribution = await fetchGitHubRelease(DISTRIBUTION_REPO);
  const distributionVersion = distribution.release?.tag_name
    ? versionFromTag(distribution.release.tag_name, "desktop")
    : null;
  const distAsset = distribution.release?.assets?.find((a) => a.name === DISTRIBUTION_FEED.manifest);
  rows.push({
    id: "desktop-distribution",
    label: DISTRIBUTION_FEED.label,
    localVersion: input.desktopVersion,
    publishedVersion: distributionVersion,
    publishedUrl:
      distAsset?.browser_download_url ??
      (distributionVersion ? DISTRIBUTION_FEED.downloadTag(distributionVersion) : null),
    ok: distributionVersion === input.desktopVersion && Boolean(distAsset),
    error:
      distribution.error ??
      (!distAsset && distributionVersion
        ? `Missing ${DISTRIBUTION_FEED.manifest} on release`
        : undefined),
  });

  const mobile = await fetchGitHubRelease(MOBILE_REPO);
  const mobileVersion = mobile.release?.tag_name
    ? versionFromTag(mobile.release.tag_name, "mobile")
    : null;

  for (const [id, feed] of Object.entries(MOBILE_FEEDS)) {
    const asset = mobile.release?.assets?.find((a) => a.name === feed.manifest);
    rows.push({
      id: `mobile-${id}`,
      label: feed.label,
      localVersion: input.mobileVersion,
      publishedVersion: mobileVersion,
      publishedUrl: asset?.browser_download_url ?? (mobileVersion ? feed.downloadTag(mobileVersion) : null),
      ok: mobileVersion === input.mobileVersion && Boolean(asset),
      error: mobile.error ?? (!mobileVersion ? "No mobile release yet" : !asset ? `Missing ${feed.manifest}` : undefined),
    });
  }

  return rows;
}

export {
  DESKTOP_FEEDS,
  DISTRIBUTION_FEED,
  ICE_CREAM_FEED,
  MOBILE_FEEDS,
  DESKTOP_REPO,
  DISTRIBUTION_REPO,
  ICE_CREAM_REPO,
  MOBILE_REPO,
};
