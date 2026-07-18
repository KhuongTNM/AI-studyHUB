package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.exception.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * CONTRACT MỚI (mục 1, AI-studyHUB_API_File.docx): API preview LUÔN trả về
 * application/pdf, bất kể file gốc là pdf/docx/pptx — FE chỉ dùng 1 loại
 * viewer (PDF.js) cho mọi loại file, không phân biệt nữa.
 *
 * File PDF gốc -> trả trực tiếp, không cần convert.
 * File docx/pptx -> convert sang PDF bằng LibreOffice headless (soffice),
 * kết quả được cache theo document id để không phải convert lại mỗi lần preview.
 *
 * YÊU CẦU DEPLOY: server phải có sẵn binary `soffice` (LibreOffice) trong PATH,
 * hoặc set app.libreoffice.path=/duong/dan/toi/soffice trong application.properties.
 * Trên Render/Docker, cần cài libreoffice trong Dockerfile, ví dụ:
 *   RUN apt-get update && apt-get install -y libreoffice --no-install-recommends
 */
@Slf4j
@Service
public class PdfPreviewService {

    @Value("${app.libreoffice.path:soffice}")
    private String sofficeCommand;

    @Value("${app.libreoffice.timeout-seconds:60}")
    private long timeoutSeconds;

    /**
     * Trả về đường dẫn tới file PDF dùng để preview cho document này.
     * - fileType = pdf  -> trả về chính file gốc.
     * - fileType khác   -> convert sang PDF (có cache), ném ApiException 422
     *                      nếu convert thất bại (vd server thiếu LibreOffice).
     */
    public Path getPreviewPdfPath(Document doc, Path sourceFile, Path uploadDir) {
        if ("pdf".equalsIgnoreCase(doc.getFileType())) {
            return sourceFile;
        }

        try {
            Path cacheDir = uploadDir.resolve("preview-cache");
            Files.createDirectories(cacheDir);
            Path cached = cacheDir.resolve(doc.getId() + ".pdf");

            if (Files.exists(cached)
                    && Files.getLastModifiedTime(cached).toMillis() >= Files.getLastModifiedTime(sourceFile).toMillis()) {
                return cached;
            }

            Path converted = convertToPdf(sourceFile, cacheDir);
            Files.move(converted, cached, StandardCopyOption.REPLACE_EXISTING);
            return cached;
        } catch (Exception e) {
            log.error("Preview PDF conversion failed for document {}: {}", doc.getId(), e.getMessage());
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Không thể tạo bản xem trước PDF cho file này. Vui lòng tải file để xem trực tiếp.");
        }
    }

    private Path convertToPdf(Path sourceFile, Path outputDir) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(
                sofficeCommand,
                "--headless",
                "--norestore",
                "--convert-to", "pdf",
                "--outdir", outputDir.toString(),
                sourceFile.toString());
        pb.redirectErrorStream(true);

        Process process = pb.start();
        // Phải đọc hết output, không thì buffer đầy sẽ làm process treo trên vài OS.
        try (InputStream is = process.getInputStream()) {
            is.readAllBytes();
        }

        boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new IOException("LibreOffice conversion timeout sau " + timeoutSeconds + "s");
        }
        if (process.exitValue() != 0) {
            throw new IOException("LibreOffice conversion thất bại, exit code = " + process.exitValue()
                    + ". Kiểm tra binary '" + sofficeCommand + "' đã được cài trên server chưa.");
        }

        String baseName = sourceFile.getFileName().toString();
        int dot = baseName.lastIndexOf('.');
        String pdfName = (dot > 0 ? baseName.substring(0, dot) : baseName) + ".pdf";
        Path result = outputDir.resolve(pdfName);
        if (!Files.exists(result)) {
            throw new IOException("Không tìm thấy file PDF sau khi convert: " + result);
        }
        return result;
    }
}
