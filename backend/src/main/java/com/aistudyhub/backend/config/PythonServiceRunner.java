package com.aistudyhub.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import java.io.File;

@Component
public class PythonServiceRunner implements ApplicationRunner {

    private static final Logger LOGGER = LoggerFactory.getLogger(PythonServiceRunner.class);

    @Override
    public void run(ApplicationArguments args) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(
            "sh", "-c", ".venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000"
        );
        pb.directory(new File("AI"));   // folder AI nằm trong backend/
        pb.redirectErrorStream(true);
        pb.redirectOutput(ProcessBuilder.Redirect.INHERIT);
        pb.start();
        LOGGER.info("Python AI Service started on port 8000");
    }
}