-- Storage is the authoritative upload boundary. Browser accept attributes and
-- client checks are only usability aids and may always be bypassed.

begin;

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/avif',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
where id = 'task-photos';

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array[
      'application/pdf',
      'image/avif',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
where id = 'crew-documents';

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'application/msword',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/avif',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain'
    ]::text[]
where id in ('documents', 'yacht-documents');

commit;
