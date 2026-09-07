import { blocks, sh } from '$lib/server/guide';
import { contract } from '$lib/server/contract';

export async function load() {
	const api = contract();
	return {
		counts: { operations: api.ops.length, models: api.models.length },
		blocks: await blocks({
			install: sh(`# TypeScript
bun add @acyka/api

# Python
pip install acyka

# Rust
cargo add acyka

# Kotlin / JVM — build.gradle.kts
implementation("cc.acyka:acyka:1.0.0")

# C#
dotnet add package Acyka

# C++ — CMakeLists.txt, header-only
FetchContent_Declare(acyka
    GIT_REPOSITORY https://github.com/cykacloud/acyka-api.git
    GIT_TAG        v1.0.0
    SOURCE_SUBDIR  packages/cpp)`)
		})
	};
}
