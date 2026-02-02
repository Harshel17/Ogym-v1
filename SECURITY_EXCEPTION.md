# Security Exception: tar Vulnerability in @capacitor/cli

## Summary

| Field | Value |
|-------|-------|
| **Vulnerability ID** | GHSA-8qq5-rm4j-mr97, GHSA-r6q2-hw4h-h46w, GHSA-34x7-hfp2-rc4v |
| **Severity** | HIGH |
| **Affected Package** | `tar@6.2.1` (transitive dependency) |
| **Direct Dependency** | `@capacitor/cli@7.4.5` |
| **Owner** | Engineering Lead / Repository Maintainer |
| **Date Created** | 2026-02-02 |
| **Review Date** | 2026-03-04 (30 days) |
| **Status** | Accepted with mitigations |

## Vulnerability Details

Three HIGH severity vulnerabilities exist in `tar@6.2.1`:

1. **GHSA-8qq5-rm4j-mr97**: Arbitrary File Overwrite and Symlink Poisoning via Insufficient Path Sanitization
2. **GHSA-r6q2-hw4h-h46w**: Race Condition in Path Reservations via Unicode Ligature Collisions (macOS APFS)
3. **GHSA-34x7-hfp2-rc4v**: Arbitrary File Creation/Overwrite via Hardlink Path Traversal

Required fix: `tar@7.5.7+`

## Why This Cannot Be Fixed

1. **npm overrides break functionality**: Overriding to `tar@7.5.7` causes `npx cap sync` to fail with API incompatibility errors (`Cannot read properties of undefined (reading 'extract')`)

2. **Major version downgrade not viable**: npm suggests `@capacitor/cli@2.5.0` which is a major version downgrade (7.x → 2.x) and would break the entire Capacitor build toolchain

3. **Upstream dependency**: The fix must come from `@capacitor/cli` updating their tar dependency

## Scope Assessment

| Factor | Assessment |
|--------|------------|
| **Dependency Type** | Development-only (`@capacitor/cli` is a build tool) |
| **Runtime Impact** | **None** - not bundled in production web or mobile artifacts |
| **Production Exposure** | **None** - tar is only used during `npx cap sync` build process |
| **Attack Vector** | Requires malicious tarball extraction during Capacitor build operations |
| **Likelihood** | Low - would require compromised npm registry or man-in-the-middle attack |

## Explicit Statement

**This vulnerability exists only in a devDependency and is NOT shipped in any production artifacts** (web builds, iOS/Android APK/IPA, or server bundles).

## Mitigations

1. **Trusted Environment**: Capacitor commands (`npx cap sync`, `npx cap build`) are only executed in trusted CI/CD environments or developer machines
2. **Package Integrity**: npm's package-lock.json ensures reproducible builds with verified package hashes
3. **Network Security**: Development environments use HTTPS for npm registry access
4. **Limited Scope**: tar extraction only occurs during mobile app build process, not at runtime

## CI/CD Recommendation

If using CI with `npm audit`:

```yaml
# Example: Allow dev-tool HIGH findings with documented exception
npm audit --audit-level=critical --omit=dev || true
# OR
npm audit --omit=dev  # Only audit production dependencies
```

## Revisit Triggers

This exception should be reviewed when:

1. `@capacitor/cli` releases a version with patched tar dependency
2. A newer tar version becomes compatible with Capacitor CLI
3. Alternative workarounds become available
4. The vulnerability is exploited in the wild

## Audit Trail

| Date | Action | By |
|------|--------|-----|
| 2026-02-02 | Exception created after testing npm overrides (broke cap sync) | Automated |
| 2026-03-04 | Scheduled review | - |
