/** Standalone activation for DeepSeek Harness 0.1.0-rc.6.
 * Upstream v0.1.10 registers through the host `themeCatalog` service
 * (@deepseek-ai/dsh-host-theme-catalog / @deepseek-ai/dsh-client-ui-theme-plugins),
 * which are not shipped with rc.6 (and unpublished on npm). This staged build
 * keeps the full self-contained client bundle and activates as a plain client
 * plugin — the same mechanism as the standalone v0.1.4 distribution.
 * See skin-manager docs (实现说明).
 */
function apply() {}
export { apply };