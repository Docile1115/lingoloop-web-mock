const SUPPORTED_DM_SCOPES = new Set(["everyone", "matches", "followers", "mutual-follows"]);

export function decideDmRoute(policy = {}, relationships = {}) {
  const scope = policy.whoCanMessage === "all" ? "everyone" : policy.whoCanMessage;
  if (!SUPPORTED_DM_SCOPES.has(scope)) return { status: "denied", scope };
  const allowed =
    scope === "everyone" ||
    (scope === "matches" && relationships.matched === true) ||
    (scope === "followers" && relationships.follower === true) ||
    (scope === "mutual-follows" && relationships.mutualFollow === true);

  if (allowed) return { status: "accepted", scope };
  if (policy.routeOthersToRequests === true) return { status: "pending", scope };
  return { status: "denied", scope };
}
