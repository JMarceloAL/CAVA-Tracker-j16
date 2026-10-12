import { StyleSheet } from 'react-native';

// As cores vêm do tema (useTheme) na própria tela; aqui ficam só
// medidas e tipografia.
export const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },

    // Seções
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginTop: 20,
        marginBottom: 8,
        marginLeft: 4,
    },
    card: {
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
    },
    divider: {
        height: 1,
        marginLeft: 50,
    },

    // Linhas
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        paddingVertical: 10,
    },
    rowIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    rowText: {
        flex: 1,
        marginRight: 8,
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    rowSubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    rowValue: {
        fontSize: 14,
        fontWeight: '600',
        maxWidth: 160,
    },
    smallButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    smallButtonText: {
        fontSize: 13,
        fontWeight: '700',
    },

    // Versão
    versionText: {
        fontSize: 13,
        marginTop: 4,
    },

    // Temas
    themeMenu: {
        paddingBottom: 10,
    },
    themeMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
    },
    themePreviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
    },
    themePreviewSwatch: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginRight: 4,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    themeName: {
        fontSize: 14,
        fontWeight: '700',
    },

    // Formulário de credenciais
    form: {
        paddingBottom: 14,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        fontSize: 15,
        marginBottom: 12,
    },
    passwordWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    passwordInput: {
        flex: 1,
        height: '100%',
        fontSize: 15,
    },
    primaryButton: {
        height: 50,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },

    // Sair
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        borderRadius: 10,
        borderWidth: 1,
        marginTop: 24,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
    },
});
