//map styles.ts

import { StyleSheet } from 'react-native';

import { APP_GREEN } from '../../theme/colors';

export const styles = StyleSheet.create({
    // ============================================================
    // CONTAINER
    // ============================================================

    container: {
        flex: 1,
        backgroundColor: '#F3F6EF',
        padding: 16,
    },

    darkContainer: {
        backgroundColor: '#121821',
    },

    // ============================================================
    // TÍTULO
    // ============================================================

    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1F241C',
        marginBottom: 16,
        letterSpacing: -0.3,
    },

    darkTitle: {
        color: '#F3F4F6',
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
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#E9F0E4',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: {
            width: 0,
            height: 3,
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

    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E6EAE0',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
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
        fontSize: 13,
        fontWeight: '700',
        color: '#5F6F5C',
        marginLeft: 6,
    },

    darkTabButtonText: {
        color: '#B8D89A',
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

    // ============================================================
    // STATUS DA VIAGEM
    // ============================================================

    movementBadge: {
        position: 'absolute',
        top: 160,
        right: 16,

        flexDirection: 'row',
        alignItems: 'center',

        backgroundColor: '#FFFFFF',

        borderRadius: 14,

        paddingHorizontal: 12,
        paddingVertical: 8,

        elevation: 4,

        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 6,

        shadowOffset: {
            width: 0,
            height: 3,
        },

        zIndex: 20,
    },

    movementBadgeDark: {
        backgroundColor: '#1B2430',
        borderWidth: 1,
        borderColor: '#303A48',
    },

    movementDot: {
        width: 9,
        height: 9,
        borderRadius: 5,
        marginRight: 7,
        backgroundColor: APP_GREEN,
    },

    movementText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#333333',
    },

    darkMovementText: {
        color: '#F3F4F6',
    },

    // ============================================================
    // ÚLTIMA PARADA
    // ============================================================

    stoppedOverlay: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 110,

        backgroundColor: '#FFFFFF',

        borderRadius: 16,

        paddingHorizontal: 14,
        paddingVertical: 12,

        elevation: 5,

        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 7,

        shadowOffset: {
            width: 0,
            height: 3,
        },

        zIndex: 20,
    },

    darkStoppedOverlay: {
        backgroundColor: '#1B2430',
        borderWidth: 1,
        borderColor: '#303A48',
    },

    stoppedTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#333333',
        marginBottom: 4,
    },

    darkStoppedTitle: {
        color: '#F3F4F6',
    },

    stoppedText: {
        fontSize: 12,
        color: '#666666',
    },

    darkStoppedText: {
        color: '#B0BAC8',
    },
});