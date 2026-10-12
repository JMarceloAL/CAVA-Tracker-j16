import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 12,
    },

    section: {
        marginTop: 6,
    },

    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 4,
    },

    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 7,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },

    label: {
        fontSize: 13,
        flex: 1,
        paddingRight: 10,
    },

    valueGroup: {
        alignItems: 'flex-end',
        flexShrink: 1,
        maxWidth: '58%',
    },

    value: {
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'right',
    },

    hint: {
        fontSize: 11,
        marginTop: 1,
        textAlign: 'right',
    },

    empty: {
        fontSize: 13,
        paddingVertical: 6,
    },

    footer: {
        fontSize: 11,
        marginTop: 10,
    },
});
