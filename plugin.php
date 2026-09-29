<?php
/**
 * Plugin Name: ACF Flexible Copy Paste
 * Description: Copy and append ACF Pro Flexible Content layouts between edit screens.
 * Version: 1.0.2
 * Author: Media Components LLC
 * License: Proprietary - Media Components LLC Internal Use Only
 * Text Domain: acf-flexible-copy-paste
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'ACF_FCP_VERSION', '1.0.2' );
define( 'ACF_FCP_FILE', __FILE__ );
define( 'ACF_FCP_URL', plugin_dir_url( __FILE__ ) );

add_action( 'admin_enqueue_scripts', 'acf_fcp_enqueue_admin_assets' );
add_action( 'acf/render_field/type=flexible_content', 'acf_fcp_inject_layout_menu_actions', 99 );

/**
 * Load assets only on post edit screens where the current user can edit.
 *
 * @param string $hook_suffix Current admin page hook.
 */
function acf_fcp_enqueue_admin_assets( $hook_suffix ) {
	if ( ! acf_fcp_can_run_on_admin_screen( $hook_suffix ) ) {
		return;
	}

	$script_handle = 'acf-flexible-copy-paste-admin';
	$style_handle  = 'acf-flexible-copy-paste-admin';
	$script_deps   = wp_script_is( 'acf-input', 'registered' ) ? array( 'jquery', 'acf-input' ) : array( 'jquery' );
	$post_id       = isset( $_GET['post'] ) ? absint( wp_unslash( $_GET['post'] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

	wp_enqueue_style(
		$style_handle,
		ACF_FCP_URL . 'assets/admin.css',
		array(),
		ACF_FCP_VERSION
	);

	wp_enqueue_script(
		$script_handle,
		ACF_FCP_URL . 'assets/admin.js',
		$script_deps,
		ACF_FCP_VERSION,
		true
	);

	wp_localize_script(
		$script_handle,
		'ACFFlexibleCopyPaste',
		array(
			'storageKey' => 'acfFlexibleCopyPaste',
			'postId'     => $post_id,
			'canEdit'    => true,
			'i18n'       => array(
				'copy'            => esc_html__( 'Copy all layouts', 'acf-flexible-copy-paste' ),
				'paste'           => esc_html__( 'Paste layouts', 'acf-flexible-copy-paste' ),
				'copySection'     => esc_html__( 'Copy Layout', 'acf-flexible-copy-paste' ),
				'pasteAfter'      => esc_html__( 'Paste After', 'acf-flexible-copy-paste' ),
				'copied'          => esc_html__( 'Flexible Content copied.', 'acf-flexible-copy-paste' ),
				'pasted'          => esc_html__( 'Flexible Content pasted.', 'acf-flexible-copy-paste' ),
				'copiedSection'   => esc_html__( 'Section copied.', 'acf-flexible-copy-paste' ),
				'pastedSection'   => esc_html__( 'Section pasted.', 'acf-flexible-copy-paste' ),
				'noRows'          => esc_html__( 'There are no layouts to copy.', 'acf-flexible-copy-paste' ),
				'noFields'        => esc_html__( 'There are no Flexible Content fields to copy.', 'acf-flexible-copy-paste' ),
				'noData'          => esc_html__( 'There is no copied Flexible Content data.', 'acf-flexible-copy-paste' ),
				'invalid'         => esc_html__( 'Copied data is invalid.', 'acf-flexible-copy-paste' ),
				'incompatible'    => esc_html__( 'Copied data belongs to a different Flexible Content field.', 'acf-flexible-copy-paste' ),
				'confirmPaste'    => esc_html__( 'Append copied Flexible Content layouts to this field?', 'acf-flexible-copy-paste' ),
				'confirmPasteAfter' => esc_html__( 'Paste copied section after this section?', 'acf-flexible-copy-paste' ),
				'storageError'    => esc_html__( 'Browser storage is unavailable.', 'acf-flexible-copy-paste' ),
				'unsupported'     => esc_html__( 'This Flexible Content field could not be updated.', 'acf-flexible-copy-paste' ),
			),
		)
	);
}

/**
 * Check admin screen, ACF availability, and user capability.
 *
 * @param string|null $hook_suffix Current admin page hook when available.
 * @return bool
 */
function acf_fcp_can_run_on_admin_screen( $hook_suffix = null ) {
	if ( ! is_admin() || ! function_exists( 'acf' ) ) {
		return false;
	}

	if ( null !== $hook_suffix && ! in_array( $hook_suffix, array( 'post.php', 'post-new.php' ), true ) ) {
		return false;
	}

	if ( null === $hook_suffix && function_exists( 'get_current_screen' ) ) {
		$screen = get_current_screen();

		if ( $screen && 'post' !== $screen->base ) {
			return false;
		}
	}

	$post_id = isset( $_GET['post'] ) ? absint( wp_unslash( $_GET['post'] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

	if ( $post_id ) {
		return current_user_can( 'edit_post', $post_id );
	}

	$post_type = 'post';

	if ( isset( $_GET['post_type'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$post_type = sanitize_key( wp_unslash( $_GET['post_type'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	} elseif ( function_exists( 'get_current_screen' ) ) {
		$screen = get_current_screen();

		if ( $screen && ! empty( $screen->post_type ) ) {
			$post_type = sanitize_key( $screen->post_type );
		}
	}

	$post_type_object = get_post_type_object( $post_type );
	$capability       = ( $post_type_object && ! empty( $post_type_object->cap->edit_posts ) ) ? $post_type_object->cap->edit_posts : 'edit_posts';

	return current_user_can( $capability );
}

/**
 * Add row copy/paste items to the native ACF 6.5+ flexible layout menu template.
 */
function acf_fcp_inject_layout_menu_actions() {
	if ( ! acf_fcp_can_run_on_admin_screen() ) {
		return;
	}

	$copy_label  = wp_json_encode( __( 'Copy Layout', 'acf-flexible-copy-paste' ) );
	$paste_label = wp_json_encode( __( 'Paste After', 'acf-flexible-copy-paste' ) );

	echo '<script>
(function() {
	var nodes = document.querySelectorAll(".tmpl-more-layout-actions");
	var node = nodes.length ? nodes[nodes.length - 1] : null;
	var search = "<a class=\"acf-rename-layout\"";
	var copyLabel = ' . $copy_label . ';
	var pasteLabel = ' . $paste_label . ';
	var insert = "<a class=\"acf-fcp-copy-layout\" data-action=\"copy-layout\" href=\"#\" role=\"menuitem\">" + copyLabel + "</a></li>\\n<li><a class=\"acf-fcp-paste-after-layout\" data-action=\"paste-after-layout\" href=\"#\" role=\"menuitem\">" + pasteLabel + "</a>";

	if (node && node.textContent.indexOf("acf-fcp-copy-layout") === -1 && node.textContent.indexOf(search) !== -1) {
		node.textContent = node.textContent.replace(search, insert + "</li>\\n<li>" + search);
	}
})();
</script>';
}
