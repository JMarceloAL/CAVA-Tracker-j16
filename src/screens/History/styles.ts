import { StyleSheet } from 'react-native';

import { APP_GREEN } from '../../theme/colors';

export const styles = StyleSheet.create({
    // ============================================================
    // CONTAINER
    // ============================================================

    container: {
        flex: 1,
        backgroundColor: '#F5F7F2',
        padding: 16,
    },

    darkContainer: {
        backgroundColor: '#121821',
    },

    // ============================================================
    // TÍTULO
    // ============================================================

    title: {
        fontSize: 26,
        fontWeight: '800',
        color: '#1F241C',
        marginBottom: 16,
        letterSpacing: -0.4,
    },

    darkTitle: {
        color: '#F3F4F6',
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    refreshButton: {
        padding: 6,
    },
    syncWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3E2',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#F7E0B2',
    },
    darkSyncWarning: {
        backgroundColor: '#3A2E1B',
        borderColor: '#5C4220',
    },
    syncWarningText: {
        fontSize: 11,
        color: '#B45309',
        marginLeft: 6,
        flex: 1,
    },
    darkSyncWarningText: {
        color: '#F3B25C',
    },

    // ============================================================
    // DROPDOWN
    // ============================================================

    dropdownContainer: {
        zIndex: 10,
        marginBottom: 12,
    },

    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#E9F0E4',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: {
            width: 0,
            height: 2,
        },
    },

    darkDropdownHeader: {
        backgroundColor: '#1B2430',
        borderColor: '#2D3745',
    },

    dropdownHeaderText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#222222',
        flex: 1,
    },

    darkDropdownHeaderText: {
        color: '#F3F4F6',
    },

    chevron: {
        fontSize: 12,
        color: '#666666',
        marginLeft: 8,
    },

    darkChevron: {
        color: '#AEB8C5',
    },

    dropdownList: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#E9F0E4',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        overflow: 'hidden',
    },

    dropdownListFloating: {
        position: 'absolute',
        marginTop: 0,
        zIndex: 20,
        elevation: 8,
    },

    darkDropdownList: {
        backgroundColor: '#1B2430',
        borderColor: '#2D3745',
    },

    dropdownItem: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },

    darkDropdownItem: {
        borderBottomColor: '#303A48',
    },

    dropdownItemText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#222222',
    },

    darkDropdownItemText: {
        color: '#F3F4F6',
    },

    dropdownItemSubtext: {
        fontSize: 12,
        color: '#888888',
        marginTop: 2,
    },

    darkDropdownItemSubtext: {
        color: '#9DA8B7',
    },

    // ============================================================
    // TEXTOS VAZIOS
    // ============================================================

    emptyText: {
        padding: 16,
        textAlign: 'center',
        color: '#888888',
    },

    darkEmptyText: {
        color: '#9DA8B7',
    },

    // ============================================================
    // ABAS
    // ============================================================

    tabRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },

    // Ícone em cima do texto: com 4 abas lado a lado, ícone + texto na
    // mesma linha não cabe ("Localizações" empurrava o ícone pra fora).
    tabButton: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 4,
        minHeight: 56,
        borderWidth: 1,
        borderColor: '#E6EAE0',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
    },

    darkTabButton: {
        backgroundColor: '#1B2430',
        borderColor: '#303A48',
    },

    tabButtonActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E6EAE0',
    },

    tabButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#5F6F5C',
        marginTop: 4,
        textAlign: 'center',
    },

    darkTabButtonText: {
        color: '#AFB9C7',
    },

    tabButtonTextActive: {
        color: '#FFFFFF',
    },

    // ============================================================
    // PASTA / ÁREA DO HISTÓRICO
    // ============================================================

    folder: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 8,
        shadowOffset: {
            width: 0,
            height: 3,
        },
        flex: 1,
        borderWidth: 1,
        borderColor: '#F0F3EC',
    },

    darkFolder: {
        backgroundColor: '#1B2430',

        borderWidth: 1,
        borderColor: '#2D3745',
    },

    folderHeader: {
        flexDirection: 'row',
        alignItems: 'center',

        paddingBottom: 10,

        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',

        marginBottom: 8,
    },

    darkFolderHeader: {
        borderBottomColor: '#303A48',
    },

    folderHeaderText: {
        fontSize: 14,
        fontWeight: '600',

        color: '#333333',

        marginLeft: 8,

        flex: 1,
    },

    darkFolderHeaderText: {
        color: '#F3F4F6',
    },

    // ============================================================
    // ITEM DO HISTÓRICO
    // ============================================================

    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',

        paddingVertical: 12,

        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },

    darkHistoryItem: {
        borderBottomColor: '#303A48',
    },

    historyItemTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333333',
    },

    darkHistoryItemTitle: {
        color: '#F3F4F6',
    },

    historyItemCoords: {
        fontSize: 12,
        color: '#666666',
        marginTop: 2,
    },

    darkHistoryItemCoords: {
        color: '#B0BAC8',
    },

    historyItemDate: {
        fontSize: 11,
        color: '#999999',
        marginTop: 2,
    },

    darkHistoryItemDate: {
        color: '#8995A5',
    },

    // ============================================================
    // ÍCONES
    // ============================================================

    historyIcon: {
        color: '#888888',
    },

    darkHistoryIcon: {
        color: '#AEB8C5',
    },

    chevronIcon: {
        color: '#CCCCCC',
    },

    darkChevronIcon: {
        color: '#667384',
    },

    // ------------------------------------------------------------
    // ABA "DIA" (trajeto do dia)
    // ------------------------------------------------------------

    dayNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },

    dayNavButton: {
        width: 44,
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    dayNavButtonDisabled: {
        opacity: 0.35,
    },

    dayNavLabelGroup: {
        alignItems: 'center',
    },

    dayNavLabel: {
        fontSize: 16,
        fontWeight: '700',
        textTransform: 'capitalize',
    },

    dayNavSub: {
        fontSize: 12,
        marginTop: 2,
    },

    dayStats: {
        flexDirection: 'row',
        gap: 8,
    },

    dayStat: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: 'center',
    },

    dayStatValue: {
        fontSize: 14,
        fontWeight: '700',
    },

    dayStatLabel: {
        fontSize: 11,
        marginTop: 2,
        textAlign: 'center',
    },

    dayNote: {
        fontSize: 12,
        lineHeight: 18,
        marginTop: 12,
    },

    dayMapButton: {
        height: 50,
        borderRadius: 10,
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },

    dayMapButtonText: {
        fontSize: 15,
        fontWeight: '700',
    },
});