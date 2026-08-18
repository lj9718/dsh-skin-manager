import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

//#region helpers (compiled-decorator runtime, same shape as shipped host Remote services)

var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};

//#endregion

//#region skin registry & zone engine

const MANAGED_START = "# --- dsh-skin managed (auto-generated; do not edit) ---";
const MANAGED_END = "# --- end dsh-skin managed ---";
const MANAGER_START = "# --- dsh-skin-manager manager row (do not remove) ---";
const MANAGER_END = "# --- end dsh-skin-manager ---";
const MANAGER_ROW_ID = "skin-manager";
const MANAGER_PKG = "@dsh-external/dsh-client-ui-skin-manager";

const ROW_ID_PATTERN = /^[A-Za-z0-9_.-]+$/;
const PKG_NAME_PATTERN = /^@[a-z0-9][a-z0-9._-]*\/[a-zA-Z0-9._-]+$/;

const readText = (file) => {
	try {
		return readFileSync(file, "utf8");
	} catch {
		return "";
	}
};

const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

const readJson = (file) => {
	const text = stripBom(readText(file));
	if (!text.trim()) return null;
	try {
		return JSON.parse(text);
	} catch (error) {
		return { __broken: true, __error: String(error && error.message || error) };
	}
};

const writeTextAtomic = (file, content) => {
	const dir = dirname(file);
	mkdirSync(dir, { recursive: true });
	const tmp = join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
	writeFileSync(tmp, content, "utf8");
	try {
		renameSync(tmp, file);
	} catch (error) {
		try {
			renameSync(tmp, file);
		} catch (error2) {
			const err = new Error(`atomic rename failed for ${file}: ${error2 && error2.message}`);
			err.cause = error2;
			throw err;
		}
	}
};

const yamlQuote = (value) => "'" + String(value).replace(/'/g, "''") + "'";

/** Derive the manager's own install directory from its module URL. */
const MODULE_FILE = fileURLToPath(import.meta.url);

function locateProfile() {
	// Walk up from .../profiles/<name>/node_modules/@dsh-external/<pkg>/lib/index.js
	let dir = dirname(dirname(MODULE_FILE));
	const segs = [];
	let guard = 0;
	while (guard++ < 16) {
		const parent = dirname(dir);
		if (parent === dir) break;
		const seg = basename(dir);
		segs.push(seg);
		if (seg === "profiles" && segs.length >= 5) {
			// segs: [pkg, @dsh-external, node_modules, <name>, profiles, ...]
			const name = segs[3];
			const profileDir = join(dir, name);
			if (existsSync(join(profileDir, "package.json"))) {
				return { home: dirname(dir), profileName: name, profileDir };
			}
		}
		dir = parent;
	}
	const home = resolveDshHome();
	const profileDir = join(home, "profiles", "web");
	return { home, profileName: "web", profileDir };
}

const locate = () => {
	const { home, profileName, profileDir } = locateProfile();
	return {
		home,
		profileName,
		profileDir,
		homePatch: join(home, "cordis.patch.yml"),
		profilePatch: join(profileDir, "cordis.patch.yml"),
		manifest: join(profileDir, "package.json"),
		profileModules: join(profileDir, "node_modules"),
		flatModules: join(home, "profiles", "node_modules")
	};
};

/** Find every skin.json under the two @dsh-external module roots (two-level scan). */
function findSkinJsonFiles(engine) {
	const results = [];
	const roots = [join(engine.profileModules, "@dsh-external"), join(engine.flatModules, "@dsh-external")];
	for (const root of roots) {
		if (!existsSync(root)) continue;
		const direct = join(root, "skin.json");
		if (existsSync(direct)) results.push(direct);
		for (const entry of readdirSync(root, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const inside = join(root, entry.name, "skin.json");
			if (existsSync(inside)) results.push(inside);
		}
	}
	return results;
}

const ROW_ID_RE = /^\s*- id:\s*(ui-skin-[A-Za-z0-9_-]+)\s*$/gm;
const ROW_INSERT_ID_RE = /^\s*- id:\s*(ui-skin-[A-Za-z0-9_-]+)\s*$/gm;

/** Collect {id, name} rows declared by non-home patch layers (profile patch + bundle patches). */
function collectExternalRows(engine) {
	const externals = new Map(); // rowId -> package name ('' when name unknown)
	const profileText = readText(engine.profilePatch);
	for (const match of profileText.matchAll(ROW_ID_RE)) {
		if (!externals.has(match[1])) externals.set(match[1], "");
	}
	try {
		const manifest = readJson(engine.manifest);
		const bundles = manifest && Array.isArray(manifest.dsh && manifest.dsh.profile && manifest.dsh.profile.bundles)
			? manifest.dsh.profile.bundles
			: [];
		const requireFromProfile = createRequire(join(engine.profileDir, "package.json"));
		for (const bundle of bundles) {
			let patchFile;
			try {
				patchFile = requireFromProfile.resolve(`${bundle}/cordis.patch.yml`);
			} catch {
				continue;
			}
			const text = readText(patchFile);
			// crude row parse: an `- id:` line; look backwards for a `name:` in the same entry
			const lines = text.split(/\r?\n/);
			let currentId = null;
			for (const line of lines) {
				const idMatch = /^\s*- id:\s*(\S+)\s*$/.exec(line);
				if (idMatch) {
					currentId = idMatch[1];
					if (ROW_ID_RE.test(line)) {
						if (!externals.has(currentId)) externals.set(currentId, "");
					}
					continue;
				}
				if (currentId && /^\s*name:\s*['"]?(@?[^'"\s]+)['"]?\s*$/.exec(line)) {
					const name = RegExp.$1;
					if (!externals.get(currentId)) externals.set(currentId, name);
					currentId = null;
				}
			}
		}
	} catch {
		// manifest/bundles unreadable — proceed without external detection
	}
	return externals;
}

/** Read the rows the home-layer managed blocks currently declare (id -> {disabled}). */
function readManagedRows(engine) {
	const text = readText(engine.homePatch);
	const rows = new Map(); // id -> { disabled: boolean, name: string }
	// insert entries first
	const insertBlock = /- insert:\n((?:\s+- .*\n?)*)/.exec(text);
	const start = text.indexOf(MANAGED_START);
	const end = text.indexOf(MANAGED_END, start);
	const zone = start >= 0 && end >= 0 ? text.slice(start + MANAGED_START.length, end) : (insertBlock ? insertBlock[0] : "");
	for (const m of zone.matchAll(/^\s+- id:\s*(\S+)\s*\n\s+name:\s*['"]?(@?[^'"\s]+)['"]?/gm)) {
		if (!rows.has(m[1])) rows.set(m[1], { disabled: false, name: m[2] });
	}
	for (const m of zone.matchAll(/^\s+- id:\s*(\S+)\s*$/gm)) {
		if (!rows.has(m[1])) rows.set(m[1], { disabled: false, name: "" });
	}
	for (const m of zone.matchAll(/^\s*- id:\s*(\S+)\s*\n\s*disabled:\s*true/gm)) {
		const id = m[1];
		const row = rows.get(id) || { disabled: false, name: "" };
		row.disabled = true;
		rows.set(id, row);
	}
	return rows;
}

/** Derive a unique loader row id for one skin package. */
function deriveRowId(pkgName) {
	const base = pkgName.slice(pkgName.lastIndexOf("/") + 1);
	const short = base.replace(/^dsh-client-ui-skin-/, "");
	return "ui-skin-" + short;
}

/**
 * Render the home-layer managed block: flags ONLY (no inserts). The watched
 * home include re-applies this file onto its accumulated data on every edit,
 * so any persistent `insert` would duplicate its row on the next write
 * ("duplicate loader entry id"). Rows are declared statically in the PROFILE
 * patch by the installer; the home file only toggles `disabled`.
 */
function renderZone(engine, registry, liveRowIds, activePkg, externalRows) {
	const lines = [];
	lines.push(MANAGED_START);
	// Emit an EXPLICIT flag for every registered live row: `disabled: true` for
	// inactive skins, `disabled: false` for the active one. The watched include
	// re-applies the file onto its accumulated data, so a removed flag would
	// leave a stale `disabled: true` behind and the skin could never re-enable.
	for (const skin of registry) {
		if (!liveRowIds.has(skin.rowId)) continue; // unregistered row: nothing to flag
		const disabled = skin.pkg !== activePkg;
		lines.push(`- id: ${skin.rowId}`);
		lines.push(`  disabled: ${disabled}`);
	}
	// A comments-only file parses to `null`, which is NOT a valid patch list
	// and breaks the include ("must be a top-level YAML array"). Emit an empty
	// array when there are no flags so the file stays valid.
	if (lines.length === 1) lines.push("[]");
	lines.push(MANAGED_END);
	return lines.join("\n") + "\n";
}

/** Replace/append the managed block inside the home patch, preserving user content (idempotent). */
function writeHomePatch(engine, registry, skinByRowId, activePkg, liveRowIds) {
	const externalRows = collectExternalRows(engine);
	const zone = renderZone(engine, registry, liveRowIds, activePkg, externalRows);
	const current = readText(engine.homePatch);
	const start = current.indexOf(MANAGED_START);
	const end = current.indexOf(MANAGED_END, start);
	let head = current;
	let tail = "";
	if (start >= 0 && end >= 0) {
		head = current.slice(0, start);
		tail = current.slice(end + MANAGED_END.length);
	}
	const zoneTrim = zone.trim();
	const prevTrim = (start >= 0 && end >= 0 ? current.slice(start, end + MANAGED_END.length) : "").trim();
	if (zoneTrim === prevTrim) return { files: [], changed: false };
	const blocks = [];
	if (head.trim() !== "") blocks.push(head.trimEnd());
	blocks.push(zoneTrim);
	if (tail.trim() !== "") blocks.push(tail.trim());
	const next = blocks.join("\n\n") + "\n";
	try {
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const backup = `${engine.homePatch}.bak-${stamp}`;
		mkdirSync(dirname(backup), { recursive: true });
		renameSync(engine.homePatch, backup);
	} catch {
		// backup best-effort only
	}
	writeTextAtomic(engine.homePatch, next);
	return { files: [engine.homePatch], changed: true };
}

/** Build the registry snapshot with previews, broken markers, and active state. */
function scanRegistry(engine, loaderEntries) {
	const skins = [];
	const rowIdToPkg = new Map();
	const byPkg = new Map();
	for (const skinFile of findSkinJsonFiles(engine)) {
		const pkgDir = dirname(skinFile);
		const meta = readJson(skinFile);
		const pkgJson = readJson(join(pkgDir, "package.json"));
		const pkgName = pkgJson && typeof pkgJson.name === "string" ? pkgJson.name : (meta && meta.package) || basename(pkgDir);
		if (!PKG_NAME_PATTERN.test(pkgName)) continue;
		const clientBundle = join(pkgDir, "lib", "client.js");
		const broken = !pkgJson || !!pkgJson.__broken || !existsSync(clientBundle);
		const brokenReason = !pkgJson ? "missing package.json"
			: pkgJson.__broken ? `package.json parse error: ${pkgJson.__error}`
				: !existsSync(clientBundle) ? "missing lib/client.js"
					: null;
		const rowId = deriveRowId(pkgName);
		rowIdToPkg.set(rowId, pkgName);
		const preview = (rel) => {
			if (broken || !meta || !meta.preview || typeof rel !== "string") return null;
			const file = join(pkgDir, String(meta.preview[rel] || ""));
			try {
				const buf = readFileSync(file);
				return `data:image/webp;base64,${buf.toString("base64")}`;
			} catch {
				return null;
			}
		};
		const entry = {
			key: pkgName.slice(pkgName.lastIndexOf("/") + 1),
			pkg: pkgName,
			rowId,
			id: meta && typeof meta.id === "string" ? meta.id : pkgName,
			name: meta && typeof meta.name === "string" ? meta.name : pkgName,
			nameEn: meta && typeof meta.nameEn === "string" ? meta.nameEn : "",
			tagline: meta && typeof meta.tagline === "string" ? meta.tagline : "",
			accent: meta && typeof meta.accent === "string" ? meta.accent : null,
			order: meta && typeof meta.order === "number" ? meta.order : 99,
			broken,
			brokenReason,
			preview: {
				light: preview("light"),
				dark: preview("dark")
			},
			active: false
		};
		skins.push(entry);
		byPkg.set(pkgName, entry);
	}
	skins.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, "zh"));
	const activePkg = detectActive(engine, loaderEntries, byPkg);
	if (activePkg && byPkg.has(activePkg)) byPkg.get(activePkg).active = true;
	return { skins, byPkg, rowIdToPkg, activePkg };
}

/** Determine the active package from live loader entries (fallback: parsed managed rows). */
function detectActive(engine, loaderEntries, byPkg) {
	if (loaderEntries && loaderEntries.length > 0) {
		for (const skin of byPkg.values()) {
			const entry = loaderEntries.find((e) => e.options && e.options.name === skin.pkg);
			if (entry && !entry.disabled) return skin.pkg;
		}
		return null;
	}
	const rows = readManagedRows(engine);
	const zone = readText(engine.homePatch);
	const start = zone.indexOf(MANAGED_START);
	const end = zone.indexOf(MANAGED_END, start);
	if (start < 0 || end < 0) return null;
	for (const skin of byPkg.values()) {
		const row = rows.get(skin.rowId);
		if (row && !row.disabled) return skin.pkg;
	}
	return null;
}

const fail = (code, message) => ({ status: "error", code, message });

//#endregion

//#region gateway

let SkinManagerGateway = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _list_decorators, _current_decorators, _apply_decorators, _reset_decorators;
	return class SkinManagerGateway extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_list_decorators = [Remote("list")];
			__esDecorate(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: { has: (obj) => "list" in obj, get: (obj) => obj.list },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			_current_decorators = [Remote("current")];
			__esDecorate(this, null, _current_decorators, {
				kind: "method",
				name: "current",
				static: false,
				private: false,
				access: { has: (obj) => "current" in obj, get: (obj) => obj.current },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			_apply_decorators = [Remote("apply")];
			__esDecorate(this, null, _apply_decorators, {
				kind: "method",
				name: "apply",
				static: false,
				private: false,
				access: { has: (obj) => "apply" in obj, get: (obj) => obj.apply },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			_reset_decorators = [Remote("reset")];
			__esDecorate(this, null, _reset_decorators, {
				kind: "method",
				name: "reset",
				static: false,
				private: false,
				access: { has: (obj) => "reset" in obj, get: (obj) => obj.reset },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = ["loader"];
		constructor(ctx) {
			super(ctx, "skinManager");
			__runInitializers(this, _instanceExtraInitializers);
			this.lastConfigError = null;
			this.ctx.on("hmr/config-update-failed", (filename, error) => {
				this.lastConfigError = { filename, message: error && error.message ? String(error.message) : String(error) };
			});
		}
		loaderEntries() {
			try {
				const entries = [];
				for (const entry of this.ctx.loader.entries()) entries.push(entry);
				return entries;
			} catch {
				return null;
			}
		}
		snapshot() {
			const engine = locate();
			const loaderEntries = this.loaderEntries();
			const { skins, byPkg, rowIdToPkg, activePkg } = scanRegistry(engine, loaderEntries);
			// rc.7 loader entries carry the row id at entry.options.id (rc.6 exposed entry.id).
			const liveRowIds = new Set((loaderEntries ?? [])
				.map((e) => (e.options && typeof e.options.id === "string" ? e.options.id : typeof e.id === "string" ? e.id : null))
				.filter((id) => id !== null));
			return { engine, loaderEntries, skins, byPkg, rowIdToPkg, activePkg, liveRowIds };
		}
		/** Poll the loader tree until every rowId shows the expected disabled state (3s cap). */
		async waitForRows(expected) {
			const deadline = Date.now() + 3000;
			while (Date.now() < deadline) {
				const entries = this.loaderEntries() ?? [];
				let ok = true;
				for (const [rowId, wantDisabled] of expected) {
					// rc.7 loader entries carry the row id at entry.options.id.
					const entry = entries.find((e) => (e.options && e.options.id === rowId) || (e.id === rowId));
					if (!entry || Boolean(entry.disabled) !== Boolean(wantDisabled)) {
						ok = false;
						break;
					}
				}
				if (ok) return true;
				await new Promise((resolve) => setTimeout(resolve, 150));
			}
			return false;
		}
		list() {
			try {
				const { engine, skins, activePkg } = this.snapshot();
				return {
					status: "ok",
					profile: engine.profileName,
					homePatch: engine.homePatch,
					skins,
					active: activePkg,
					warning: this.lastConfigError ? `home 层配置热重载失败：${this.lastConfigError.message}` : null
				};
			} catch (error) {
				return fail("list-failed", error && error.message ? String(error.message) : String(error));
			}
		}
		current() {
			try {
				const { activePkg } = this.snapshot();
				return { status: "ok", active: activePkg };
			} catch (error) {
				return fail("current-failed", error && error.message ? String(error.message) : String(error));
			}
		}
		async apply(pkgKey) {
			try {
				const snap = this.snapshot();
				const skin = snap.byPkg.get(pkgKey);
				if (!skin) {
					// allow both full package names and bare keys
					const match = [...snap.byPkg.values()].find((s) => s.key === pkgKey);
					if (!match) return fail("unknown-skin", `未安装皮肤 '${pkgKey}'`);
					return this.apply(match.pkg);
				}
				if (skin.broken) return fail("package-broken", `皮肤包不完整：${skin.brokenReason || "unknown"}`);
				if (!snap.liveRowIds.has(skin.rowId)) {
					return fail("row-not-registered", `皮肤行 ${skin.rowId} 尚未注册，请运行 install-skins.ps1 注册并重启服务后使用`);
				}
				const { files, changed } = writeHomePatch(snap.engine, snap.skins, snap.rowIdToPkg, skin.pkg, snap.liveRowIds);
				const expected = new Map();
				for (const s of snap.skins) {
					if (snap.liveRowIds.has(s.rowId)) expected.set(s.rowId, s.pkg !== skin.pkg);
				}
				expected.set(skin.rowId, false);
				const applied = changed ? await this.waitForRows(expected) : true;
				if (!applied) {
					return fail("hmr-failed", "配置已写入，但 HMR 未能在预期时间内应用；请刷新页面确认，或手动重启服务");
				}
				this.lastConfigError = null;
				return {
					status: "ok",
					active: skin.pkg,
					files,
					note: "配置已写入，HMR 热重载后刷新页面即可生效"
				};
			} catch (error) {
				return fail("apply-failed", error && error.message ? String(error.message) : String(error));
			}
		}
		async reset() {
			try {
				const snap = this.snapshot();
				const { files, changed } = writeHomePatch(snap.engine, snap.skins, snap.rowIdToPkg, null, snap.liveRowIds);
				const expected = new Map();
				for (const s of snap.skins) if (snap.liveRowIds.has(s.rowId)) expected.set(s.rowId, true);
				const applied = changed ? await this.waitForRows(expected) : true;
				if (!applied) {
					return fail("hmr-failed", "配置已写入，但 HMR 未能在预期时间内应用；请刷新页面确认，或手动重启服务");
				}
				this.lastConfigError = null;
				return { status: "ok", active: null, files, note: "已恢复官方默认界面，刷新页面后生效" };
			} catch (error) {
				return fail("reset-failed", error && error.message ? String(error.message) : String(error));
			}
		}
	};
})();

//#endregion

export { SkinManagerGateway, SkinManagerGateway as default };