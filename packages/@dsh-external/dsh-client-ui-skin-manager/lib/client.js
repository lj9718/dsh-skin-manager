window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-skin-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var react = require("react");

		//#region locale
		const NS = "settings.skinManager";
		const zh = {
			title: "外观 · 皮肤",
			hint: "选择你要使用的界面皮肤。切换会改写 home 层配置并经 HMR 热重载，页面自动刷新后生效，无需重启服务器。",
			official: "官方默认界面",
			officialHint: "不启用任何皮肤，恢复 DeepSeek Harness 原生外观。",
			active: "当前使用",
			apply: "应用",
			applying: "切换中…",
			applied: "已切换，页面即将刷新…",
			reset: "恢复官方默认",
			resetting: "处理中…",
			resetDone: "已恢复官方默认界面，页面即将刷新…",
			failed: "操作失败",
			broken: "皮肤包不完整",
			error: "无法读取皮肤列表",
			retry: "重试",
			empty: "暂未发现已安装的皮肤。将包含 skin.json 的皮肤包复制到 profiles 的 node_modules/@dsh-external 下即可在此管理。",
			attribution: "皮肤使用 CC BY-NC-SA 4.0 许可，仅限个人及非商业使用；画师：上善 / ZipZipPipe。",
			licensing: "本页为外观切换管理（dsh-client-ui-skin-manager）。皮肤版权归原作者所有。"
		};
		const en = {
			title: "Appearance · Skins",
			hint: "Pick the UI skin to use. Switching rewrites the home-layer patch (config HMR), then the page reloads — no server restart needed.",
			official: "Official UI",
			officialHint: "Disable every skin and restore the stock DeepSeek Harness look.",
			active: "In use",
			apply: "Apply",
			applying: "Applying…",
			applied: "Switched — the page is about to reload…",
			reset: "Restore official",
			resetting: "Working…",
			resetDone: "Official UI restored — the page is about to reload…",
			failed: "Operation failed",
			broken: "Broken skin package",
			error: "Could not read the skin list",
			retry: "Retry",
			empty: "No skins installed. Copy a package with skin.json into profiles node_modules/@dsh-external to manage it here.",
			attribution: "Skins are CC BY-NC-SA 4.0, personal and non-commercial use only; artists: Shangshan / ZipZipPipe.",
			licensing: "This page manages appearance switching (dsh-client-ui-skin-manager). Skin copyright belongs to their authors."
		};
		//#endregion

		//#region views
		const card = {
			display: "flex",
			flexDirection: "row",
			gap: "12px",
			alignItems: "center",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: "10px",
			background: "var(--dsw-alias-bg-layer-3)",
			padding: "12px"
		};
		const thumb = {
			width: "88px",
			height: "56px",
			borderRadius: "6px",
			objectFit: "cover",
			flexShrink: 0,
			background: "var(--dsw-alias-bg-layer-1)"
		};
		const nameStyle = {
			margin: 0,
			fontSize: "14px",
			fontWeight: 600,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-primary)"
		};
		const subStyle = {
			margin: "2px 0 0",
			fontSize: "12px",
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const badge = {
			display: "inline-flex",
			alignItems: "center",
			gap: "5px",
			fontSize: "11px",
			lineHeight: "16px",
			padding: "1px 8px",
			borderRadius: "999px",
			background: "var(--dsw-alias-state-business-primary)",
			color: "var(--dsw-alias-label-primary)",
			marginTop: "6px"
		};
		const button = {
			font: "inherit",
			cursor: "pointer",
			border: "1px solid var(--dsw-alias-border-l2)",
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
			borderRadius: "8px",
			padding: "6px 14px",
			fontSize: "13px",
			flexShrink: 0
		};
		const section = {
			width: "100%",
			maxWidth: "760px",
			display: "flex",
			flexDirection: "column",
			gap: "12px",
			color: "var(--dsw-alias-label-primary)"
		};

		function SkinManagerSection(props) {
			const list = props.list;
			const applySkin = props.applySkin;
			const resetSkin = props.resetSkin;
			const t = props.t;
			const [state, setState] = react.useState({ status: "loading" });
			const [busy, setBusy] = react.useState(null);
			const [notice, setNotice] = react.useState(null);
			const load = react.useCallback(() => {
				let current = true;
				setState({ status: "loading" });
				Promise.resolve().then(() => list()).then((value) => {
					if (current) setState({ status: "ready", value });
				}, () => {
					if (current) setState({ status: "error" });
				});
				return () => { current = false; };
			}, [list]);
			react.useEffect(load, [load]);
			const run = (job, doneMessage) => {
				if (busy) return;
				setBusy(true);
				setNotice(null);
				Promise.resolve().then(() => job()).then((value) => {
					if (!value || value.status !== "ok") {
						setNotice({ kind: "error", text: `${t("failed")}: ${value && value.message || ""}${value && value.code ? " (" + value.code + ")" : ""}` });
						return;
					}
					setNotice({ kind: "ok", text: doneMessage });
					setTimeout(() => { window.location.reload(); }, 1200);
				}, (error) => {
					setNotice({ kind: "error", text: `${t("failed")}: ${error && error.message || String(error)}` });
				}).then(() => setBusy(null), () => setBusy(null));
			};
			const rows = [];
			rows.push(react.createElement("p", { key: "hint", style: subStyle }, t("hint")));
			if (state.status === "loading") {
				rows.push(react.createElement("p", { key: "loading", style: subStyle }, "…"));
			} else if (state.status === "error") {
				rows.push(react.createElement("div", {
					key: "error",
					style: { display: "flex", alignItems: "center", gap: "10px" }
				},
					react.createElement("span", { style: subStyle }, t("error")),
					react.createElement("button", { style: button, onClick: load }, t("retry"))));
			} else {
				const skins = state.value.skins || [];
				if (skins.length === 0) {
					rows.push(react.createElement("p", { key: "empty", style: subStyle }, t("empty")));
				}
				for (const skin of skins) {
					const inner = [
						skin.preview && skin.preview.light
							? react.createElement("img", { key: "img", src: skin.preview.light, alt: skin.name, style: thumb })
							: react.createElement("div", { key: "img", style: Object.assign({}, thumb, { display: "flex", alignItems: "center", justifyContent: "center" }) }, "—")
					];
					const info = [
						react.createElement("div", {
							key: "name",
							style: { display: "flex", alignItems: "center", gap: "8px" }
						},
							react.createElement("p", { style: nameStyle }, skin.name || skin.key),
							skin.accent ? react.createElement("span", {
								style: { width: "10px", height: "10px", borderRadius: "50%", background: skin.accent, border: "1px solid var(--dsw-alias-border-l2)", flexShrink: 0 }
							}) : null,
							skin.nameEn ? react.createElement("span", { style: subStyle }, skin.nameEn) : null),
						react.createElement("p", { style: subStyle }, skin.tagline || (skin.key))
					];
					if (skin.active) {
						info.push(react.createElement("span", { key: "badge", style: badge }, "● " + t("active")));
					} else if (skin.broken) {
						info.push(react.createElement("span", { key: "badge", style: Object.assign({}, badge, { background: "var(--dsw-alias-state-error-primary)" }) }, t("broken") + (skin.brokenReason ? " · " + skin.brokenReason : "")));
					}
					inner.push(react.createElement("div", { key: "info", style: { flex: 1, minWidth: 0 } }, info));
					if (!skin.active && !skin.broken) {
						inner.push(react.createElement("button", {
							key: "go",
							style: button,
							disabled: busy !== null,
							onClick: () => run(() => applySkin(skin.pkg).then((v) => { if (v && v.status !== "ok") throw new Error(v.message || v.code); return v; }), t("applied"))
						}, busy === skin.pkg ? t("applying") : t("apply")));
					}
					rows.push(react.createElement("div", { key: skin.pkg, style: card }, inner));
				}
				rows.push(react.createElement("div", { key: "official", style: card },
					react.createElement("div", { style: { flex: 1 } },
						react.createElement("p", { style: nameStyle }, t("official")),
						react.createElement("p", { style: subStyle }, t("officialHint"))),
					busy === "__official__"
						? react.createElement("span", { style: subStyle }, t("resetting"))
						: react.createElement("button", {
							style: button,
							disabled: busy !== null,
							onClick: () => run(() => resetSkin().then((v) => { if (v && v.status !== "ok") throw new Error(v.message || v.code); return v; }), t("resetDone"))
						}, t("reset"))));
			}
			if (notice) {
				rows.push(react.createElement("p", {
					key: "notice",
					style: Object.assign({}, subStyle, notice.kind === "error" ? { color: "var(--dsw-alias-state-error-primary)" } : {})
				}, notice.text));
			}
			rows.push(react.createElement("p", { key: "lic", style: Object.assign({}, subStyle, { marginTop: "6px" }) }, t("attribution") + " " + t("licensing")));
			return react.createElement("div", { style: section }, rows);
		}
		//#endregion

		//#region plugin body
		const inject = ["slots", "locale", "remote", "remote.skinManager"];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-skin-manager: dictionaries");
			const t = ctx.locale.bind(NS);
			const call = async (method) => {
				const result = await ctx.remote.skinManager[method]();
				if (!result.ok) throw new Error(`skinManager.${method} failed: ${result.error && result.error.code}: ${result.error && result.error.message}`);
				return result.value;
			};
			const injected = () => ({
				list: () => call("list"),
				applySkin: (pkg) => ctx.remote.skinManager.apply(pkg).then((result) => {
					if (!result.ok) throw new Error(`skinManager.apply failed: ${result.error && result.error.code}: ${result.error && result.error.message}`);
					return result.value;
				}),
				resetSkin: () => ctx.remote.skinManager.reset().then((result) => {
					if (!result.ok) throw new Error(`skinManager.reset failed: ${result.error && result.error.code}: ${result.error && result.error.message}`);
					return result.value;
				}),
				t
			});
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "skins",
				order: 5,
				label: () => t("title"),
				locale: NS,
				inject: injected
			}, SkinManagerSection));
		}
		//#endregion

		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});