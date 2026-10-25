---
"@rustrak/server": patch
---

Debug files for Android, JVM and Apple apps. ProGuard/R8 mappings and JVM source bundles deobfuscate JVM events, and dSYMs with native source bundles symbolicate Apple native events, all uploaded with the Sentry Android Gradle plugin or `sentry-cli` through the new `difs/assemble` and `files/dsyms` endpoints. `@rustrak/client` gains `debugFiles.assemble` and `debugFiles.upload`, and the dashboard shows an event's dist next to its release.
