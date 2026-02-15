import SwiftUI

struct PaperCardView: View {
    let paper: Paper

    private var addedDateFormatted: String {
        paper.relativeAddedDate
    }

    var body: some View {
        HStack(spacing: 0) {
            // Unread accent bar
            if !paper.isRead {
                RoundedRectangle(cornerRadius: 2)
                    .fill(SkimTheme.accent)
                    .frame(width: 3)
                    .padding(.vertical, 6)
            }

            VStack(alignment: .leading, spacing: 10) {
                // MARK: - Title
                Text(paper.title)
                    .font(SkimTheme.subheadingFont)
                    .foregroundColor(SkimTheme.textPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                // MARK: - Authors
                Text(paper.formattedAuthors)
                    .font(SkimTheme.captionFont)
                    .foregroundColor(SkimTheme.textSecondary)
                    .lineLimit(1)

                // MARK: - Metadata Row
                metadataRow

                // MARK: - Summary Preview
                if let summary = paper.summary, !summary.isEmpty {
                    Text(summary)
                        .font(SkimTheme.bodyFont)
                        .foregroundColor(SkimTheme.textSecondary)
                        .lineLimit(2)
                        .lineSpacing(2)
                }

                // MARK: - Tags + Date Row
                HStack(alignment: .bottom) {
                    if !paper.tags.isEmpty {
                        tagsRow
                    }
                    Spacer()
                    Text(addedDateFormatted)
                        .font(.system(size: 11, weight: .regular, design: .rounded))
                        .foregroundColor(SkimTheme.textTertiary)
                }
            }
            .padding(SkimTheme.paddingMedium)
        }
        .background(SkimTheme.surfaceElevated)
        .cornerRadius(SkimTheme.cornerRadius)
        .overlay(
            RoundedRectangle(cornerRadius: SkimTheme.cornerRadius)
                .stroke(SkimTheme.border.opacity(0.5), lineWidth: 0.5)
        )
    }

    // MARK: - Metadata Row (Category, Source, Rating)

    private var metadataRow: some View {
        HStack(spacing: 8) {
            // Category
            HStack(spacing: 4) {
                Image(systemName: paper.category.icon)
                    .font(.system(size: 11))
                Text(paper.category.rawValue)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
            }
            .foregroundColor(SkimTheme.accent.opacity(0.85))

            dividerDot

            // Source badge
            Text(paper.source.displayName)
                .font(.system(size: 10, weight: .semibold, design: .rounded))
                .foregroundColor(SkimTheme.accentSecondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    Capsule()
                        .fill(SkimTheme.accentSecondary.opacity(0.15))
                )

            // Rating badge (if available)
            if paper.rating != nil {
                dividerDot
                ratingBadge
            }
        }
    }

    private var dividerDot: some View {
        Circle()
            .fill(SkimTheme.textTertiary)
            .frame(width: 3, height: 3)
    }

    private var ratingBadge: some View {
        HStack(spacing: 3) {
            Image(systemName: "star.fill")
                .font(.system(size: 9))
            Text(paper.ratingLabel)
                .font(.system(size: 11, weight: .bold, design: .rounded))
        }
        .foregroundColor(SkimTheme.ratingColor(for: paper.rating))
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(
            Capsule()
                .fill(SkimTheme.ratingColor(for: paper.rating).opacity(0.15))
        )
    }

    // MARK: - Tags

    private var tagsRow: some View {
        HStack(spacing: 6) {
            ForEach(paper.tags.prefix(3), id: \.self) { tag in
                Text("#\(tag)")
                    .font(.system(size: 10, weight: .medium, design: .rounded))
                    .foregroundColor(SkimTheme.textTertiary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(SkimTheme.surface)
                    )
            }
        }
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        SkimTheme.background.ignoresSafeArea()

        VStack(spacing: 12) {
            PaperCardView(paper: Paper(
                id: "1",
                title: "Attention Is All You Need: Revisiting Transformer Architectures for Long-Form Reasoning",
                authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
                abstract: "We propose a new simple network architecture...",
                url: "https://arxiv.org/abs/1706.03762",
                pdfURL: nil,
                markdownContent: nil,
                summary: "Introduces the Transformer architecture, replacing recurrence with self-attention for sequence-to-sequence tasks.",
                rating: 9,
                category: .computerScience,
                tags: ["transformers", "attention", "NLP"],
                source: .arxiv,
                publishedDate: nil,
                addedDate: "2025-01-15T09:30:00Z",
                isRead: false
            ))

            PaperCardView(paper: Paper(
                id: "2",
                title: "CRISPR-Cas9 Editing in Neuronal Cells",
                authors: ["Jane Doe"],
                abstract: "",
                url: "https://pubmed.ncbi.nlm.nih.gov/12345",
                pdfURL: nil,
                markdownContent: nil,
                summary: nil,
                rating: nil,
                category: .neuroscience,
                tags: [],
                source: .pubmed,
                publishedDate: nil,
                addedDate: "2025-01-12T10:30:00Z",
                isRead: true
            ))
        }
        .padding()
    }
}
