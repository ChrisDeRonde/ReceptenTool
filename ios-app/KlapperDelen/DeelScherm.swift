import SwiftUI

/// Het kaartje dat opkomt als je vanuit Instagram, Safari of de AH-app op
/// Klapper tikt in het deelmenu. Dezelfde huisstijl als de app (`Stijl.swift`)
/// — geen eigen kleurenpalet, dit hoort er zichtbaar bij te horen.
struct DeelScherm: View {
    @Bindable var model: DeelModel
    let annuleer: () -> Void
    let klaar: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.25)
                .ignoresSafeArea()
                .onTapGesture(perform: annuleer)

            kaart
                .frame(maxWidth: 360)
                .padding(.horizontal, 20)
        }
    }

    private var kaart: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Bewaren in Klapper")
                .font(Letter.kop(19))
                .foregroundStyle(Kleur.inkt)

            inhoud

            if model.namen.count > 1 {
                namenRij
            }

            knop

            if case let .fout(bericht) = model.status {
                Text(bericht)
                    .font(Letter.tekst(14).weight(.medium))
                    .foregroundStyle(Kleur.waarschuwing)
            }

            Button("Annuleer", action: annuleer)
                .font(Letter.tekst(15))
                .foregroundStyle(Kleur.gedempt)
                .frame(maxWidth: .infinity)
        }
        .padding(20)
        .background(Kleur.vel)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private var inhoud: some View {
        if model.nietAangemeld {
            Text("Nog niet aangemeld in Klapper. Open de app en meld je aan.")
                .font(Letter.tekst(14))
                .foregroundStyle(Kleur.waarschuwing)
        } else if let voorbeeld = model.voorbeeld, !voorbeeld.isEmpty {
            Text(voorbeeld.count > 160 ? String(voorbeeld.prefix(160)) + "…" : voorbeeld)
                .font(Letter.tekst(14))
                .foregroundStyle(Kleur.gedempt)
                .lineLimit(3)
        } else {
            Text("Hier zit geen link of tekst in.")
                .font(Letter.tekst(14))
                .foregroundStyle(Kleur.gedempt)
        }
    }

    /// Dezelfde keuze als op het inlogscherm: wie noteert dit.
    private var namenRij: some View {
        HStack(spacing: 8) {
            ForEach(model.namen, id: \.self) { naam in
                let aan = model.wie == naam
                Button(naam) { model.wie = naam }
                    .font(Letter.tekst(15).weight(.medium))
                    .foregroundStyle(aan ? Kleur.salie : Kleur.inkt)
                    .frame(maxWidth: .infinity)
                    .frame(height: 42)
                    .background(aan ? Kleur.salieZacht : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(aan ? Kleur.salie : Kleur.lijn)
                    )
            }
        }
    }

    private var knop: some View {
        Button {
            Task {
                if await model.bewaar() {
                    try? await Task.sleep(for: .seconds(0.7))
                    klaar()
                }
            }
        } label: {
            Text(model.status == .bezig ? "Bezig…" : "Bewaren")
                .font(Letter.tekst(17).weight(.semibold))
                .frame(maxWidth: .infinity)
                .frame(height: Stijl.raakhoogte + 4)
        }
        .buttonStyle(.borderedProminent)
        .tint(Kleur.salie)
        .disabled(!model.kanBewaren)
    }
}
