package com.aistudyhub.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import java.io.File;
import java.io.IOException;

@Component
public class PythonServiceRunner implements ApplicationRunner {

    private static final Logger LOGGER = LoggerFactory.getLogger(PythonServiceRunner.class);

    @Override
    public void run(ApplicationArguments args) throws Exception {
        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");

        String workingDir = System.getProperty("user.dir");

        File aiDir = new File(workingDir, "AI");
        if (!aiDir.exists()) {
            aiDir = new File(workingDir, "backend/AI");
        }

        LOGGER.info("Starting Python AI Service in directory: {}", aiDir.getAbsolutePath());

        if (!aiDir.exists()) {
            LOGGER.warn("AI directory not found. Skipping Python service startup.");
            return;
        }

        ProcessBuilder pb = isWindows
                ? new ProcessBuilder("cmd.exe", "/c", ".venv\\Scripts\\uvicorn.exe main:app --host 0.0.0.0 --port 8000")
                : new ProcessBuilder("sh", "-c", ".venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000");

        pb.environment().put("OPENAI_API_KEY", "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");
        pb.directory(aiDir);
        pb.redirectErrorStream(true);
        pb.redirectOutput(ProcessBuilder.Redirect.INHERIT);
        pb.start();

        LOGGER.info("Python AI Service started on port 8000");
    }
}