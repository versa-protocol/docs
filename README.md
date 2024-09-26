# Versa Protocol Docs

Public docs for the Versa Protocol

## Local development

It's recommended that you install [pnpm] and add the following pre-commit hook to your `.git/hooks/pre-commit`:

```sh
#!/bin/sh
FILES=$(git diff --cached --name-only --diff-filter=ACMR | sed 's| |\\ |g')
[ -z "$FILES" ] && exit 0

# Prettify all selected files
echo "$FILES" | xargs pnpm dlx prettier . --write

# Add back the modified/prettified files to staging
echo "$FILES" | xargs git add

exit 0
```

You may need to run `chmod +x .git/hooks/pre-commit` to make the hook executable.

This will ensure that all files are formatted correctly before committing.
