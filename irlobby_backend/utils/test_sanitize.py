from django.test import SimpleTestCase

from utils.sanitize import strip_html


class StripHtmlTests(SimpleTestCase):
    def test_strips_script_tags(self):
        self.assertEqual(strip_html('<script>alert("xss")</script>Hello'), 'alert("xss")Hello')

    def test_strips_html_tags(self):
        self.assertEqual(strip_html("<b>bold</b> text"), "bold text")

    def test_strips_nested_tags(self):
        self.assertEqual(strip_html("<div><p>nested</p></div>"), "nested")

    def test_passes_plain_text(self):
        self.assertEqual(strip_html("just plain text"), "just plain text")

    def test_handles_empty_string(self):
        self.assertEqual(strip_html(""), "")

    def test_handles_none(self):
        self.assertIsNone(strip_html(None))

    def test_strips_img_tag(self):
        result = strip_html('<img src="x" onerror="alert(1)">text')
        self.assertEqual(result, "text")

    def test_preserves_ampersand_text(self):
        self.assertEqual(strip_html("Tom & Jerry"), "Tom & Jerry")

    def test_strips_style_tag(self):
        result = strip_html("<style>body{display:none}</style>visible")
        self.assertIn("visible", result)
        self.assertNotIn("<style>", result)
