// Urbanex social profiles (clean URLs, without share/tracking parameters)
export const SOCIAL = {
  facebook: { name: "Facebook", handle: "urbanexrealty", url: "https://www.facebook.com/urbanexrealty" },
  instagram: { name: "Instagram", handle: "@urbanexbyayandey", url: "https://www.instagram.com/urbanexbyayandey/" },
  threads: { name: "Threads", handle: "@urbanexbyayandey", url: "https://www.threads.com/@urbanexbyayandey" },
  youtube: { name: "YouTube", handle: "@urbanexbyayandey", url: "https://www.youtube.com/@urbanexbyayandey" },
};

// Page plugin: shows the page's latest posts (public pages only)
export const facebookEmbed = (w, h) =>
  `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(SOCIAL.facebook.url)}&tabs=timeline&width=${w}&height=${h}&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false`;

// Profile embed: shows the profile with its recent posts
export const instagramEmbed = `${SOCIAL.instagram.url}embed/`;
