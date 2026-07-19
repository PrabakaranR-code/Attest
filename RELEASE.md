# Releasing v0.1.0

The v0.1.0 annotated tag exists locally in the build session but the session
relay blocks tag pushes and there is no release-creation API available to it
(SPEC.md §11 fallback). Everything else is done: `main` holds the released
state (merge commit `fc3ce1c`, PR #1), CI is green, and the triple acceptance
run passed. To publish the release, run as the repository owner:

```bash
git clone https://github.com/PrabakaranR-code/Attest.git && cd Attest

# 1. Tag the release commit on main
git tag -a v0.1.0 fc3ce1c630f828d6959b4af42d07e9b27a50fc91 \
  -m "Attest v0.1.0 — stateless verified web capture engine"
git push origin v0.1.0

# 2. Create the GitHub release from the tag
gh release create v0.1.0 --title "Attest v0.1.0" \
  --notes-file CHANGELOG.md

# 3. (Optional) make main the default branch if it is not already
gh api -X PATCH repos/PrabakaranR-code/Attest -f default_branch=main
```

After that this file can be deleted.
