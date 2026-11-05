import CoreImage.CIFilterBuiltins

enum LightningAddressQRCode {
    private static let context = CIContext()

    static func image(for address: String) -> CGImage? {
        guard !address.isEmpty else { return nil }
        let filter = CIFilter.qrCodeGenerator()
        // Match the receive screen: encode the Lightning address itself.
        filter.message = Data(address.utf8)
        filter.correctionLevel = "M"
        guard let code = filter.outputImage else { return nil }

        // Keep the compact white border opaque in dark and tinted widgets.
        // Core Image includes one module; add one more around it.
        let bounds = code.extent.insetBy(dx: -1, dy: -1)
        let background = CIImage(color: .white).cropped(to: bounds)
        let image = code.composited(over: background)
            .transformed(by: CGAffineTransform(scaleX: 8, y: 8))
        return context.createCGImage(image, from: image.extent)
    }
}
