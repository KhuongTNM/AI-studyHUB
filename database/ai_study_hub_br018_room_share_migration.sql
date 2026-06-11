USE AIStudyHub;
GO

IF COL_LENGTH('study_room_messages', 'document_id') IS NULL
BEGIN
    ALTER TABLE study_room_messages
        ADD document_id UNIQUEIDENTIFIER NULL;

    ALTER TABLE study_room_messages
        ADD CONSTRAINT fk_srmsg_document
        FOREIGN KEY (document_id) REFERENCES documents(id);
END;
GO

DECLARE @constraintName NVARCHAR(128);
SELECT @constraintName = cc.name
FROM sys.check_constraints cc
JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name = 'study_room_messages'
  AND cc.name = 'chk_srmsg_type';

IF @constraintName IS NOT NULL
BEGIN
    ALTER TABLE study_room_messages DROP CONSTRAINT chk_srmsg_type;
END;
GO

ALTER TABLE study_room_messages
    ADD CONSTRAINT chk_srmsg_type
    CHECK (message_type IN (N'user', N'system', N'document'));
GO
