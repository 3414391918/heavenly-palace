import { cp, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = await mkdtemp(join(tmpdir(), "virtual-world-standalone-tools-"));
try {
  await cp(join(project, "apps/desktop/out/toolkit"), join(root, "tools"), {
    recursive: true
  });
  await mkdir(join(root, "books"), { recursive: true });
  const call = (tool, request, book) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [
          join(root, "tools", tool, "cli.mjs"),
          "--input",
          "-",
          ...(book ? ["--book", book] : [])
        ],
        { input: JSON.stringify(request), encoding: "utf8" }
      )
    );
  const created = call("workspace", {
    action: "create",
    input: {
      parentDirectory: join(root, "books"),
      title: "工具独立验收",
      genre: "玄幻"
    }
  });
  const book = created.projectDirectory;
  const index = call("workspace", { action: "index" }, book);
  const fileId = index.workspaceIndex.bookLine.id;
  const before = call("workspace", { action: "read", input: { fileId } }, book);
  call(
    "workspace",
    {
      action: "write",
      input: {
        fileId,
        content: "# 故事线\n\n独立工具写入。\n",
        expectedSha256: before.sha256
      }
    },
    book
  );
  assert.match(
    call("workspace", { action: "read", input: { fileId } }, book).content,
    /独立工具写入/
  );
  assert.ok(
    call("workspace", { action: "schema", input: { name: "apply" } }).schema
      .properties.operations
  );
  const chapter = index.workspaceIndex.chapters[0];
  assert.ok(chapter, "新建小说应包含可供插图的首章");
  const chapterBefore = call(
    "workspace",
    { action: "read", input: { fileId: chapter.body.id } },
    book
  );
  call(
    "workspace",
    {
      action: "write",
      input: {
        fileId: chapter.body.id,
        content: "# 第一章\n\n欲仙楼的石台旁，慕星离停下脚步。\n",
        expectedSha256: chapterBefore.sha256
      }
    },
    book
  );
  const chapterReady = call(
    "workspace",
    { action: "read", input: { fileId: chapter.body.id } },
    book
  );
  const sourceImage = join(root, "scene.png");
  await cp(
    join(project, "apps/desktop/src/renderer/public/app-icon.png"),
    sourceImage
  );
  const added = call(
    "workspace",
    {
      action: "illustration.add",
      input: {
        chapterCardId: chapter.chapterCardId,
        imagePath: sourceImage,
        expectedSha256: chapterReady.sha256,
        offset: chapterReady.content.length
      }
    },
    book
  );
  assert.equal(added.filename, "001.png");
  assert.equal(added.reference, "![](images/001.png)");
  assert.match(
    call(
      "workspace",
      { action: "read", input: { fileId: chapter.body.id } },
      book
    ).content,
    /!\[\]\(images\/001\.png\)/
  );
  assert.deepEqual(
    await readFile(added.imagePath),
    await readFile(sourceImage)
  );
  const references = call(
    "workspace",
    {
      action: "illustration.references",
      input: { chapterCardId: chapter.chapterCardId }
    },
    book
  ).references;
  assert.equal(references.length, 1);
  assert.equal(references[0].path, added.imagePath);
  assert.equal(references[0].available, true);
  assert.match(references[0].nearbyText, /欲仙楼/);
  assert.throws(
    () =>
      call(
        "workspace",
        {
          action: "illustration.add",
          input: {
            chapterCardId: chapter.chapterCardId,
            imagePath: sourceImage,
            expectedSha256: chapterReady.sha256,
            offset: chapterReady.content.length
          }
        },
        book
      ),
    /章节正文已更新/
  );
  assert.ok(
    call("workspace", { action: "schema", input: { name: "character.assets" } })
      .schema.properties.characterId
  );
  const batch = {
    updatedAt: new Date().toISOString(),
    operations: [
      {
        type: "featureSettings.update",
        patch: { worldbuildingItemLayout: "left-tree" }
      }
    ]
  };
  call("workspace", { action: "preview", input: batch }, book);
  call("workspace", { action: "apply", input: batch }, book);
  assert.equal(
    call("workspace", { action: "index" }, book).workspaceIndex.featureSettings
      .worldbuildingItemLayout,
    "left-tree"
  );
  assert.ok(
    JSON.parse(
      await readFile(join(book, ".virtual-world-created.json"), "utf8")
    ).version
  );
  const library = call("creation-context", {
    action: "createLibrary",
    input: { domain: "skill", name: "写作方法", skillKind: "general" }
  });
  const directory = library.projectDirectory;
  const entry = call("creation-context", {
    action: "createEntry",
    input: {
      libraryDirectory: directory,
      title: "因果检查",
      content: "检查因果。",
      baseProjectRevision: library.revision
    }
  });
  assert.equal(
    call("creation-context", {
      action: "read",
      input: { libraryDirectory: directory, entryId: entry.id }
    }).entry.content,
    "检查因果。"
  );
  const context = call("creation-context", {
    action: "bookContext",
    input: { bookDirectory: book }
  });
  assert.equal(context.libraries.libraries.length, 1);
  console.log(
    "Standalone toolkit smoke passed: copied files, schema, novel create/read/write/structure/illustrations, library create/read, shared context and discovery markers; no Electron or node_modules."
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
