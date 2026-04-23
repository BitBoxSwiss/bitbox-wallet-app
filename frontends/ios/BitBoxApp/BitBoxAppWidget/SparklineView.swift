import SwiftUI

struct SparklineView: View {
    let prices: [Double]
    let lineColor: Color

    var body: some View {
        GeometryReader { geo in
            if prices.count >= 2,
               let minPrice = prices.min(),
               let maxPrice = prices.max() {
                let width = geo.size.width
                let height = geo.size.height

                if maxPrice > minPrice {
                    let stepX = width / CGFloat(prices.count - 1)
                    let range = maxPrice - minPrice

                    Path { path in
                        path.move(to: CGPoint(x: 0, y: yPosition(for: prices[0], min: minPrice, range: range, height: height)))
                        for index in 1..<prices.count {
                            path.addLine(to: CGPoint(x: stepX * CGFloat(index), y: yPosition(for: prices[index], min: minPrice, range: range, height: height)))
                        }
                    }
                    .stroke(lineColor, lineWidth: 2)
                } else {
                    let midY = height / 2
                    Path { path in
                        path.move(to: CGPoint(x: 0, y: midY))
                        path.addLine(to: CGPoint(x: width, y: midY))
                    }
                    .stroke(lineColor, lineWidth: 2)
                }
            }
        }
    }

    private func yPosition(for price: Double, min: Double, range: Double, height: CGFloat) -> CGFloat {
        let normalized = (price - min) / range
        return height * (1 - CGFloat(normalized))
    }
}
