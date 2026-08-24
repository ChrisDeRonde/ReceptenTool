import Foundation

/// Hoe JSON in en uit dit project gaat.
///
/// Eén plek, want er zijn er drie die het nodig hebben — de klant, de kast en
/// straks de deelextensie — en drie decoders die net iets anders zijn afgesteld
/// is een bug die je pas maanden later vindt.
///
/// **Waarom niet gewoon `.iso8601`.** Die strategie gebruikt
/// `ISO8601DateFormatter` met standaardinstellingen, en die weigert fractionele
/// seconden. De server draait op Node, en `Date.prototype.toISOString()` zet er
/// altijd milliseconden in: `2026-08-16T21:23:20.756Z`. Met de kale `.iso8601`
/// mislukt dus élke decodering van élk antwoord — de app zou niet één recept
/// binnenkrijgen, met als enige spoor een `.onleesbaar` die nergens naar wijst.
///
/// Dus: eerst mét fracties proberen, dan zonder. Ruimhartig zijn in wat je
/// accepteert kost hier vier regels en scheelt een avond zoeken.
extension JSONDecoder {
    static var klapper: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { ontleder in
            let tekst = try ontleder.singleValueContainer().decode(String.self)
            if let datum = ISO8601.metFracties.date(from: tekst) { return datum }
            if let datum = ISO8601.zonderFracties.date(from: tekst) { return datum }
            throw DecodingError.dataCorrupted(
                .init(
                    codingPath: ontleder.codingPath,
                    debugDescription: "Geen ISO-8601-datum: \(tekst)"
                )
            )
        }
        return decoder
    }
}

extension JSONEncoder {
    /// Schrijven doen we mét fracties, en dat is geen kwestie van smaak.
    ///
    /// De kast wordt met deze encoder weggeschreven, en `bijgewerkt` gaat er
    /// mee doorheen. Rondden we hier af op hele seconden, dan leest de volgende
    /// koude start `…20.000` terug terwijl de server `…20.756` meldt, en dan is
    /// `stempel.bijgewerkt > hier` waar voor élk recept: de app haalt bij iedere
    /// start de hele collectie opnieuw op, en elke keer schrijft hij hem weer
    /// afgerond terug. Binnen één sessie valt er niets van te merken — de datums
    /// in het geheugen kloppen wel — en dat is precies wat het zo'n vervelende
    /// maakt.
    static var klapper: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { datum, codeerder in
            var houder = codeerder.singleValueContainer()
            try houder.encode(ISO8601.metFracties.string(from: datum))
        }
        return encoder
    }
}

/// De twee formatters, één keer gemaakt. `ISO8601DateFormatter` opzetten is
/// duur genoeg om niet per veld te doen, en een recept heeft er drie.
private enum ISO8601 {
    static let metFracties: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let zonderFracties: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
