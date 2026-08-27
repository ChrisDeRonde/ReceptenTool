import SwiftUI
import UIKit

/// De huisstijl, dezelfde als op het web.
///
/// De waarden komen één op één uit `src/app/globals.css`; staat daar ooit een
/// andere kleur, dan hoort hij hier ook te veranderen. Wit als drager, foto's
/// als kleur, en ruimte in plaats van lijnen — de salie is er alleen voor wat
/// je aantikt.
///
/// De fonts moeten als bestand in het target zitten (Nunito en Nunito Sans uit
/// `public/fonts`, of hun statische `.ttf`-varianten van Google Fonts) en in
/// Info.plist onder `UIAppFonts` staan. Ontbreken ze, dan valt `Font.custom`
/// stil terug op het systeemfont — daarom staat er in `Stijl.controleerFonts()`
/// een waarschuwing die je in de console ziet in plaats van dat je je afvraagt
/// waarom het er raar uitziet.
enum Kleur {
    static let papier = dynamisch(licht: 0xFFFFFF, donker: 0x141413)
    static let vel = dynamisch(licht: 0xFFFFFF, donker: 0x1D1D1B)
    static let verzonken = dynamisch(licht: 0xF5F4F1, donker: 0x262523)
    static let lijn = dynamisch(licht: 0xEBEAE6, donker: 0x322F2C)
    /// Waar een lijn een scheiding moet zijn en geen zucht: de rand om een
    /// tweede knop, om een invoerveld, om een chip.
    static let lijnSterk = dynamisch(licht: 0xDDDCD7, donker: 0x423E39)

    static let inkt = dynamisch(licht: 0x1C1A17, donker: 0xF6F3EE)
    static let tekst = dynamisch(licht: 0x423D37, donker: 0xD6D1C9)
    static let gedempt = dynamisch(licht: 0x6D675F, donker: 0x9A948B)

    static let salie = dynamisch(licht: 0x477060, donker: 0x93BDA6)
    static let salieInkt = dynamisch(licht: 0xFFFFFF, donker: 0x14201A)
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
    /// Titels: Nunito, zwaar gezet. Het gewicht maakt de kop, niet de soort
    /// letter — vandaar `.heavy` (800) en niet `.semibold`.
    static func kop(_ grootte: CGFloat) -> Font {
        .custom("Nunito", size: grootte).weight(.heavy)
    }

    static func tekst(_ grootte: CGFloat) -> Font {
        .custom("Nunito Sans", size: grootte)
    }

    /// Een bovenkopje: klein, wijd gespatieerd, hoofdletters.
    static let eyebrow = Font.custom("Nunito Sans", size: 12).weight(.semibold)
}

enum Stijl {
    /// Aantikbare dingen zijn minstens zo hoog, ook als ze er licht uitzien.
    static let raakhoogte: CGFloat = 44

    /// Dezelfde drie rondingen als op het web. `pil` is voor alles wat je
    /// aantikt, de rest voor vlakken die iets bevatten.
    static let rSm: CGFloat = 10
    static let rMd: CGFloat = 14
    static let rLg: CGFloat = 18
    static let pil: CGFloat = 999

    /// Roept dit bij het opstarten aan; een stil teruggevallen font is een bug
    /// die je pas ziet als je de schermafdrukken naast elkaar legt.
    static func controleerFonts() {
        #if DEBUG
        // De naam moet de PostScript-naam zijn zoals Xcode hem meldt; bij de
        // statische varianten van Google is dat "Nunito-ExtraBold" en
        // "NunitoSans-Regular". Klopt er iets niet, dan zegt deze regel het.
        for naam in ["Nunito", "Nunito Sans"] where UIFont(name: naam, size: 12) == nil {
            print("⚠️ Font '\(naam)' ontbreekt — voeg het bestand toe aan het target en aan UIAppFonts.")
        }
        #endif
    }
}
