import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.2.0"
    kotlin("plugin.serialization") version "2.2.0"
    `maven-publish`
    signing
}

group = "cc.acyka"
version = "1.0.0"
description = "A client for the acyka API: the catalogue, profiles, lists and writing."

repositories {
    mavenCentral()
}

dependencies {
    implementation(platform("org.jetbrains.kotlinx:kotlinx-coroutines-bom:1.9.0"))
    api("org.jetbrains.kotlinx:kotlinx-coroutines-core")
    api("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    val ktor = "3.0.3"
    api("io.ktor:ktor-client-core:$ktor")
    implementation("io.ktor:ktor-client-cio:$ktor")
    implementation("io.ktor:ktor-client-content-negotiation:$ktor")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktor")

    testImplementation(kotlin("test"))
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test")
    // The transport is tested against a fake engine rather than a mocked client:
    // what is being tested is what happens to headers, statuses and a body on
    // the way through.
    testImplementation("io.ktor:ktor-client-mock:$ktor")
}

kotlin {
    // The target, set on the compiler rather than through `jvmToolchain`.
    //
    // A toolchain makes the build download a JDK of its own, which is the right
    // answer for an application and the wrong one for a library: it turns
    // `./gradlew build` into something that needs the network and a provisioning
    // plugin on a machine that already has a perfectly good newer JDK. Targeting
    // 17 from whatever is installed produces the same bytecode.
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
    // `explicitApi` because this is a library: a declaration that forgot its
    // visibility is a declaration accidentally in the public surface, and a
    // public surface is a thing that has to be kept.
    explicitApi()
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.test {
    useJUnitPlatform()
}

java {
    withSourcesJar()
    withJavadocJar()
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(17)
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "acyka"
            pom {
                name.set("acyka")
                description.set(project.description)
                url.set("https://dev.acyka.cc")
                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://opensource.org/licenses/MIT")
                    }
                }
                developers {
                    developer {
                        name.set("acyka")
                        url.set("https://acyka.cc")
                    }
                }
                scm {
                    url.set("https://github.com/cykacloud/acyka-api")
                    connection.set("scm:git:https://github.com/cykacloud/acyka-api.git")
                }
            }
        }
    }
    repositories {
        maven {
            name = "central"
            url = uri("https://ossrh-staging-api.central.sonatype.com/service/local/staging/deploy/maven2/")
            credentials {
                username = System.getenv("MAVEN_CENTRAL_USERNAME")
                password = System.getenv("MAVEN_CENTRAL_PASSWORD")
            }
        }
    }
}

signing {
    // Maven Central will not take an unsigned artifact. The key is in CI and
    // nowhere else, so a local `publishToMavenLocal` works without one.
    val key = System.getenv("MAVEN_GPG_KEY")
    val password = System.getenv("MAVEN_GPG_PASSWORD")
    if (key != null && password != null) {
        useInMemoryPgpKeys(key, password)
        sign(publishing.publications["maven"])
    }
}
