import Foundation
import Security

/// Waar het token en het serveradres blijven.
///
/// Het token in de Keychain en niet in `UserDefaults`: het is precies zo goed
/// als het wachtwoord van de voordeur, en `UserDefaults` is een plist die
/// meegaat in een onversleutelde back-up. Het adres mag wél in de defaults —
/// dat is geen geheim, en het staat in de deelextensie ook al.
///
/// `kSecAttrAccessibleAfterFirstUnlock` en niet `WhenUnlocked`: de deelextensie
/// moet er ook bij kunnen, en die kan draaien terwijl het scherm op slot zit.
/// De toegangsgroep is dezelfde App Group als de gedeelde map, zodat app en
/// extensie hetzelfde token zien.
///
/// `@unchecked Sendable` en niet zomaar: dit ding wordt vanuit twee kanten
/// aangeraakt — de `Klant`-actor en de hoofddraad — en houdt zelf geen
/// veranderlijke staat vast. Alles gaat rechtstreeks naar `UserDefaults` en de
/// Keychain, en die zijn allebei draadveilig. Komt er ooit een veld bij dat
/// wél in het geheugen blijft staan, dan klopt deze belofte niet meer.
final class Sleutelbos: @unchecked Sendable {
    static let standaard = Sleutelbos()

    /// Moet gelijk zijn aan de App Group in beide targets.
    static let groep = "group.nl.klapper.gedeeld"

    private let dienst = "nl.klapper.token"
    private let sleutel = "sessie"
    private let defaults = UserDefaults(suiteName: Sleutelbos.groep) ?? .standard

    var serveradres: URL? {
        get { defaults.url(forKey: "serveradres") }
        set { defaults.set(newValue, forKey: "serveradres") }
    }

    /// De naam die deze telefoon standaard bij een kooklogregel zet.
    var ik: String? {
        get { defaults.string(forKey: "ik") }
        set { defaults.set(newValue, forKey: "ik") }
    }

    var token: String? {
        get { lees() }
        set {
            if let newValue { schrijf(newValue) } else { wis() }
        }
    }

    // MARK: - Keychain

    private var basis: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: dienst,
            kSecAttrAccount as String: sleutel,
        ]
    }

    private func lees() -> String? {
        var vraag = basis
        vraag[kSecReturnData as String] = true
        vraag[kSecMatchLimit as String] = kSecMatchLimitOne

        var uit: CFTypeRef?
        guard SecItemCopyMatching(vraag as CFDictionary, &uit) == errSecSuccess,
              let data = uit as? Data,
              let tekst = String(data: data, encoding: .utf8),
              !tekst.isEmpty
        else { return nil }
        return tekst
    }

    private func schrijf(_ waarde: String) {
        let data = Data(waarde.utf8)

        // Eerst proberen bij te werken; bestaat het nog niet, dan toevoegen.
        // Andersom levert `errSecDuplicateItem` op en dan blijft het oude token
        // staan — precies het soort fout dat je pas merkt als je uitlogt.
        let bijwerken: [String: Any] = [kSecValueData as String: data]
        if SecItemUpdate(basis as CFDictionary, bijwerken as CFDictionary) == errSecSuccess {
            return
        }

        var nieuw = basis
        nieuw[kSecValueData as String] = data
        nieuw[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(nieuw as CFDictionary, nil)
    }

    private func wis() {
        SecItemDelete(basis as CFDictionary)
    }
}
