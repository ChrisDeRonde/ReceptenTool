import SwiftUI
import UIKit

/// De huisstijl, dezelfde als op het web.
///
/// De waarden komen één op één uit `src/app/globals.css`; staat daar ooit een
/// andere kleur, dan hoort hij hier ook te veranderen. Warm papier in plaats van
/// wit, pastelvlakken in plaats van verzadigde kleur, haarlijnen in plaats van
/// randen.
///
/// De fonts moeten als bestand in het target zitten (Fraunces en Source Sans 3
/// uit `public/fonts`, of hun statische varianten) en in Info.plist onder
/// `UIAppFonts` staan. Ontbreken ze, dan valt `Font.custom` stil terug op het
/// systeemfont — daarom staat er in `Stijl.controleerFonts()` een waarschuwing
/// die je in de console ziet in plaats van dat je je afvraagt waarom het er raar
/// uitziet.
enum Kleur {
    static let papier = dynamisch(licht: 0xF8F5EF, donker: 0x151412)
    static let vel = dynamisch(licht: 0xFFFEFA, donker: 0x1E1C19)
    static let verzonken = dynamisch(licht: 0xF0EBE0, donker: 0x272420)
    static let lijn = dynamisch(licht: 0xE5DED0, donker: 0x35302A)

    static let inkt = dynamisch(licht: 0x1E1C18, donker: 0xF5EFE5)
    static let tekst = dynamisch(licht: 0x454039, donker: 0xD8D1C6)
    static let gedempt = dynamisch(licht: 0x6E6760, donker: 0x9A9287)

    static let salie = dynamisch(licht: 0x477060, donker: 0x93BDA6)
    static let salieInkt = dynamisch(licht: 0xFFFEFA, donker: 0x14201A)
    static let salieZacht = dynamisch(licht: 0xE1EBE4, donker: 0x25332C)

    static let zand = dynamisch(licht: 0xF3E7D3, donker: 0x332D23)
    static let waarschuwing = dynamisch(licht: 0x87672A, donker: 0xD3B06A)
    static let ster = dynamisch(licht: 0xA97B1C, donker: 0xD3B06A)
    static let lint = Color(hex: 0xD8A441)

    private static func dynamisch(licht: Int, donker: Int) -> Color {
        Color(UIColor { kenmerken in
            kenmerken.userInterfaceStyle == .dark
                ? UIColor(Color(hex: donker))
                : UIColor(Color(hex: licht))
        })
    }
}

extension Color {
    init(hex: Int) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

enum Letter {
    /// Titels: een zachte oudschreef. Zie de opmerking bovenaan over UIAppFonts.
    static func kop(_ grootte: CGFloat) -> Font {
        .custom("Fraunces", size: grootte).weight(.semibold)
    }

    static func tekst(_ grootte: CGFloat) -> Font {
        .custom("SourceSans3", size: grootte)
    }

    /// Een bovenkopje: klein, wijd gespatieerd, hoofdletters.
    static let eyebrow = Font.custom("SourceSans3", size: 12).weight(.semibold)
}

enum Stijl {
    /// Aantikbare dingen zijn minstens zo hoog, ook als ze er licht uitzien.
    static let raakhoogte: CGFloat = 44

    /// Roept dit bij het opstarten aan; een stil teruggevallen font is een bug
    /// die je pas ziet als je de schermafdrukken naast elkaar legt.
    static func controleerFonts() {
        #if DEBUG
        for naam in ["Fraunces", "SourceSans3"] where UIFont(name: naam, size: 12) == nil {
            print("⚠️ Font '\(naam)' ontbreekt — voeg het bestand toe aan het target en aan UIAppFonts.")
        }
        #endif
    }
}
