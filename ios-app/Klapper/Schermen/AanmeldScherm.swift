import SwiftUI

/// Eén keer per toestel: waar staat de server, en wat is het wachtwoord.
///
/// Daarna leeft het token in de Keychain en zie je dit scherm nooit meer —
/// tenzij het wachtwoord op de server verandert, en dan hóór je het te zien.
struct AanmeldScherm: View {
    @Environment(Voorraad.self) private var voorraad

    @State private var adres = ""
    @State private var wachtwoord = ""
    @FocusState private var focus: Veld?

    private enum Veld { case adres, wachtwoord }

    private var adresUrl: URL? {
        let schoon = adres.trimmingCharacters(in: .whitespaces)
        guard !schoon.isEmpty else { return nil }
        let met = schoon.contains("://") ? schoon : "https://\(schoon)"
        guard let url = URL(string: met), url.host() != nil else { return nil }
        return url
    }

    var body: some View {
        VStack(spacing: 22) {
            Spacer()

            Merkteken()
                .frame(width: 56, height: 56)

            Text("Klapper")
                .font(Letter.kop(34))
                .foregroundStyle(Kleur.inkt)

            Text("Waar staat je server, en wat is het wachtwoord?")
                .font(Letter.tekst(15))
                .foregroundStyle(Kleur.gedempt)
                .multilineTextAlignment(.center)

            VStack(spacing: 12) {
                TextField("klapper.jouwnaam.ts.net", text: $adres)
                    .textContentType(.URL)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focus, equals: .adres)
                    .submitLabel(.next)
                    .onSubmit { focus = .wachtwoord }

                SecureField("Wachtwoord", text: $wachtwoord)
                    .textContentType(.password)
                    .focused($focus, equals: .wachtwoord)
                    .submitLabel(.go)
                    .onSubmit { Task { await meldAan() } }
            }
            .textFieldStyle(.plain)
            .font(Letter.tekst(17))
            .padding(14)
            .background(Kleur.vel, in: .rect(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Kleur.lijn, lineWidth: 1))

            if let fout = voorraad.laatsteFout {
                Text(fout)
                    .font(Letter.tekst(14))
                    .foregroundStyle(Kleur.inkt)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Kleur.zand, in: .rect(cornerRadius: 10))
                    // Een schermlezer moet dit horen zodra het er staat; het is
                    // het antwoord op wat je net deed.
                    .accessibilityAddTraits(.isStaticText)
            }

            Button {
                Task { await meldAan() }
            } label: {
                Group {
                    if voorraad.bezig {
                        ProgressView().tint(Kleur.salieInkt)
                    } else {
                        Text("Aanmelden").font(Letter.tekst(17).weight(.semibold))
                    }
                }
                .frame(maxWidth: .infinity, minHeight: Stijl.raakhoogte)
            }
            .buttonStyle(.plain)
            .background(Kleur.salie, in: .rect(cornerRadius: 12))
            .foregroundStyle(Kleur.salieInkt)
            .disabled(voorraad.bezig || adresUrl == nil || wachtwoord.isEmpty)
            .opacity(adresUrl == nil || wachtwoord.isEmpty ? 0.5 : 1)

            Spacer()
            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Kleur.papier)
        .onAppear { focus = .adres }
    }

    private func meldAan() async {
        guard let adresUrl else { return }
        _ = await voorraad.meldAan(adres: adresUrl, wachtwoord: wachtwoord)
    }
}

/// Het kookboek met de koksmuts, dezelfde vorm als `src/components/Merk.tsx`.
struct Merkteken: View {
    var body: some View {
        GeometryReader { maat in
            let s = maat.size.width / 24
            ZStack {
                RoundedRectangle(cornerRadius: 2.6 * s)
                    .fill(Kleur.salie)
                    .frame(width: 17.6 * s, height: 19.6 * s)
                    .position(x: 12 * s, y: 11.6 * s)

                Circle().fill(Kleur.papier).frame(width: 5.7 * s).position(x: 8.9 * s, y: 8.1 * s)
                Circle().fill(Kleur.papier).frame(width: 5.7 * s).position(x: 15.1 * s, y: 8.1 * s)
                Circle().fill(Kleur.papier).frame(width: 6.9 * s).position(x: 12 * s, y: 6.7 * s)
                RoundedRectangle(cornerRadius: 0.8 * s)
                    .fill(Kleur.papier)
                    .frame(width: 6.6 * s, height: 3.3 * s)
                    .position(x: 12 * s, y: 11.75 * s)
                RoundedRectangle(cornerRadius: 1.3 * s)
                    .fill(Kleur.papier)
                    .frame(width: 12.2 * s, height: 3 * s)
                    .position(x: 12 * s, y: 17.4 * s)
            }
        }
        .accessibilityHidden(true)
    }
}
